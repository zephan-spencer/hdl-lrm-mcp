/**
 * Athens HDL MCP - Database Access Layer
 *
 * Provides typed interface for querying the HDL LRM database
 */

import sqlite3 from 'sqlite3';
import { spawn, ChildProcess } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Type Definitions
// =============================================================================

export interface Section {
    id: number;
    language: string;
    section_number: string;
    parent_section: string | null;
    title: string;
    content: string;
    page_start: number;
    page_end: number;
    depth: number;
}

export interface SectionInfo {
    number: string;
    title: string;
    depth: number;
    has_subsections: boolean;
}

export interface CodeExample {
    id: number;
    section_id: number;
    language: string;
    code: string;
    description: string | null;
    line_start: number | null;
}

export interface Table {
    id: number;
    section_id: number;
    language: string;
    caption: string | null;
    content_json: string;  // JSON string
    markdown: string;
}

export interface SearchResult {
    section_number: string;
    title: string;
    snippet: string;
    page_start: number;
    relevance: number;
}

export interface CodeSearchResult {
    code: string;
    description: string | null;
    section_number: string;
    section_title: string;
    page_start: number;
    page_end: number;
}

export interface SemanticSearchResult {
    section_number: string;
    title: string;
    content: string;
    page_start: number;
    similarity: number;
}

// =============================================================================
// Database Class
// =============================================================================

export class HDLDatabase {
    private db: sqlite3.Database | null = null;
    private dbPath: string;
    private embeddingServer: ChildProcess | null = null;
    private embeddingServerPort: number = 8765;
    private embeddingServerReady: boolean = false;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * Connect to the database and start the embedding server
     * Fails if embedding server cannot be started
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, async (error) => {
                if (error) {
                    reject(new Error(`Failed to connect to database: ${error.message}`));
                } else {
                    // Start embedding server for fast semantic search (fail-fast if unavailable)
                    try {
                        await this.startEmbeddingServer();
                        resolve();
                    } catch (err) {
                        reject(new Error(`Failed to start embedding server: ${err}`));
                    }
                }
            });
        });
    }

    /**
     * Close the database connection and stop the embedding server
     */
    async close(): Promise<void> {
        // Stop embedding server first
        await this.stopEmbeddingServer();

        if (!this.db) return;

        return new Promise((resolve, reject) => {
            this.db!.close((error) => {
                if (error) {
                    reject(new Error(`Failed to close database: ${error.message}`));
                } else {
                    this.db = null;
                    resolve();
                }
            });
        });
    }

    /**
     * Full-text search across all sections
     */
    async search(
        query: string,
        language: string,
        maxResults: number = 5
    ): Promise<SearchResult[]> {
        this.ensureConnected();

        const sql = `
            SELECT
                s.section_number,
                s.title,
                snippet(sections_fts, 2, '<mark>', '</mark>', '...', 64) AS snippet,
                s.page_start,
                bm25(sections_fts) AS relevance
            FROM sections_fts
            JOIN sections s ON sections_fts.rowid = s.id
            WHERE sections_fts MATCH ?
                AND s.language = ?
            ORDER BY relevance
            LIMIT ?
        `;

        return this.all(sql, [query, language, maxResults]);
    }

    /**
     * Get complete section content
     */
    async getSection(
        sectionNumber: string,
        language: string,
        includeCode: boolean = false
    ): Promise<Section | null> {
        this.ensureConnected();

        const sql = `
            SELECT * FROM sections
            WHERE section_number = ? AND language = ?
        `;

        const section = await this.get(sql, [sectionNumber, language]);

        if (!section) return null;

        // Optionally include code examples
        if (includeCode) {
            const codes = await this.getCodeExamples(section.id);
            (section as any).code_examples = codes;
        }

        return section;
    }

    /**
     * Get subsections of a parent section
     */
    async getSubsections(
        sectionNumber: string,
        language: string
    ): Promise<SectionInfo[]> {
        this.ensureConnected();

        const sql = `
            SELECT
                section_number AS number,
                title,
                depth,
                EXISTS(
                    SELECT 1 FROM sections s2
                    WHERE s2.parent_section = sections.section_number
                        AND s2.language = sections.language
                ) AS has_subsections
            FROM sections
            WHERE parent_section = ? AND language = ?
            ORDER BY section_number
        `;

        return this.all(sql, [sectionNumber, language]);
    }

    /**
     * List sections (table of contents)
     */
    async listSections(
        language: string,
        parent: string | null = null,
        maxDepth: number = 2,
        searchFilter?: string
    ): Promise<SectionInfo[]> {
        this.ensureConnected();

        let sql: string;
        let params: any[];

        if (parent) {
            // List children of specific parent
            sql = `
                SELECT
                    section_number AS number,
                    title,
                    depth,
                    EXISTS(
                        SELECT 1 FROM sections s2
                        WHERE s2.parent_section = sections.section_number
                            AND s2.language = sections.language
                    ) AS has_subsections
                FROM sections
                WHERE language = ?
                    AND parent_section = ?
                    AND depth <= ?
            `;
            params = [language, parent, maxDepth];

            // Add search filter if provided
            if (searchFilter) {
                sql += ` AND title LIKE ?`;
                params.push(`%${searchFilter}%`);
            }

            sql += ` ORDER BY section_number`;
        } else {
            // List top-level sections (use minimum depth instead of parent_section IS NULL)
            // This fixes the bug where parser doesn't create parent sections
            sql = `
                SELECT
                    section_number AS number,
                    title,
                    depth,
                    EXISTS(
                        SELECT 1 FROM sections s2
                        WHERE s2.parent_section = sections.section_number
                            AND s2.language = sections.language
                    ) AS has_subsections
                FROM sections
                WHERE language = ?
                    AND depth = (SELECT MIN(depth) FROM sections WHERE language = ?)
                    AND depth <= ?
            `;
            params = [language, language, maxDepth];

            // Add search filter if provided (search at any depth when filtering)
            if (searchFilter) {
                sql = `
                    SELECT
                        section_number AS number,
                        title,
                        depth,
                        EXISTS(
                            SELECT 1 FROM sections s2
                            WHERE s2.parent_section = sections.section_number
                                AND s2.language = sections.language
                        ) AS has_subsections
                    FROM sections
                    WHERE language = ?
                        AND title LIKE ?
                        AND depth <= ?
                    ORDER BY depth, section_number
                `;
                params = [language, `%${searchFilter}%`, maxDepth];
            } else {
                sql += ` ORDER BY section_number`;
            }
        }

        return this.all(sql, params);
    }

    /**
     * Search code examples
     */
    async searchCode(
        query: string,
        language: string,
        maxResults: number = 10
    ): Promise<CodeSearchResult[]> {
        this.ensureConnected();

        const sql = `
            SELECT
                ce.code,
                ce.description,
                s.section_number,
                s.title AS section_title,
                s.page_start,
                s.page_end
            FROM code_examples ce
            JOIN sections s ON ce.section_id = s.id
            WHERE ce.language = ?
                AND (ce.code LIKE ? OR ce.description LIKE ?)
            LIMIT ?
        `;

        const searchPattern = `%${query}%`;
        return this.all(sql, [language, searchPattern, searchPattern, maxResults]);
    }

    /**
     * Get code examples for a section
     */
    async getCodeExamples(sectionId: number): Promise<CodeExample[]> {
        this.ensureConnected();

        const sql = `
            SELECT * FROM code_examples
            WHERE section_id = ?
            ORDER BY line_start
        `;

        return this.all(sql, [sectionId]);
    }

    /**
     * Get tables from a specific section
     */
    async getTables(
        sectionNumber: string,
        language: string
    ): Promise<Table[]> {
        this.ensureConnected();

        const sql = `
            SELECT t.*
            FROM tables t
            JOIN sections s ON t.section_id = s.id
            WHERE s.section_number = ? AND s.language = ?
        `;

        return this.all(sql, [sectionNumber, language]);
    }

    /**
     * Semantic search using text query
     * Encodes query text and finds semantically similar sections
     *
     * Note: Uses Qwen/Qwen3-Embedding-0.6B (8192 token context, 768-dim embeddings)
     */
    async semanticSearchByText(
        queryText: string,
        language: string,
        maxResults: number = 5,
        model: string = 'Qwen/Qwen3-Embedding-0.6B'
    ): Promise<SemanticSearchResult[]> {
        // Encode query text to embedding
        const queryEmbedding = await this.encodeQueryText(queryText, model);

        // Perform semantic search with embedding
        return this.semanticSearch(queryEmbedding, language, maxResults, model);
    }

    /**
     * Semantic search using pre-computed embedding
     * Note: Requires embeddings to be generated first with generate_embeddings.py
     */
    async semanticSearch(
        queryEmbedding: number[],
        language: string,
        maxResults: number = 5,
        model: string = 'Qwen/Qwen3-Embedding-0.6B'
    ): Promise<SemanticSearchResult[]> {
        this.ensureConnected();

        // Get all sections with embeddings for this language
        const sql = `
            SELECT 
                s.section_number,
                s.title,
                s.content,
                s.page_start,
                e.embedding_json
            FROM section_embeddings e
            JOIN sections s ON e.section_id = s.id
            WHERE s.language = ? AND e.embedding_model = ?
        `;

        const rows = await this.all(sql, [language, model]);

        // Compute cosine similarity for each section
        const results = rows.map(row => {
            const embedding = JSON.parse(row.embedding_json);
            const similarity = this.cosineSimilarity(queryEmbedding, embedding);

            return {
                section_number: row.section_number,
                title: row.title,
                content: row.content, // Full content - let handler/agent decide on length
                page_start: row.page_start,
                similarity: similarity
            };
        });

        // Sort by similarity descending and return top N
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxResults);
    }

    /**
     * Get database statistics
     */
    async getStats(language?: string): Promise<{
        sections: number;
        code_examples: number;
        tables: number;
        embeddings?: number;
    }> {
        this.ensureConnected();

        const filter = language ? 'WHERE language = ?' : '';
        const params = language ? [language, language, language] : [];

        const [sectionsCount] = await this.all(
            `SELECT COUNT(*) as count FROM sections ${filter}`,
            language ? [language] : []
        );

        const [codeCount] = await this.all(
            `SELECT COUNT(*) as count FROM code_examples ${filter}`,
            language ? [language] : []
        );

        const [tablesCount] = await this.all(
            `SELECT COUNT(*) as count FROM tables ${filter}`,
            language ? [language] : []
        );

        const [embeddingsCount] = await this.all(
            `SELECT COUNT(*) as count FROM section_embeddings ${filter}`,
            language ? [language] : []
        );

        return {
            sections: sectionsCount.count,
            code_examples: codeCount.count,
            tables: tablesCount.count,
            embeddings: embeddingsCount.count,
        };
    }

    // =============================================================================
    // Embedding Server Lifecycle
    // =============================================================================

    /**
     * Start the embedding server for fast semantic search
     * Keeps the embedding model loaded in memory to avoid repeated loading overhead
     */
    private async startEmbeddingServer(): Promise<void> {
        const pythonPath = this.getPythonPath();
        const serverPath = join(__dirname, '..', '..', 'src', 'embeddings', 'embedding_server.py');

        console.log('[EmbeddingServer] Starting embedding server on port', this.embeddingServerPort);

        this.embeddingServer = spawn(pythonPath, [
            serverPath,
            '--port', this.embeddingServerPort.toString(),
            '--host', '127.0.0.1',
            '--model', 'Qwen/Qwen3-Embedding-0.6B'
        ]);

        // Handle server output
        this.embeddingServer.stdout?.on('data', (data) => {
            const output = data.toString();
            console.log('[EmbeddingServer]', output.trim());

            // Check if server is ready
            if (output.includes('Running on')) {
                this.embeddingServerReady = true;
            }
        });

        this.embeddingServer.stderr?.on('data', (data) => {
            const output = data.toString();
            console.error('[EmbeddingServer]', output.trim());

            // Flask logs to stderr by default, so also check there for ready signal
            if (output.includes('Running on') || output.includes('Server ready')) {
                this.embeddingServerReady = true;
            }
        });

        this.embeddingServer.on('close', (code) => {
            console.log('[EmbeddingServer] Server exited with code', code);
            this.embeddingServerReady = false;
        });

        // Wait for server to be ready (with timeout)
        const maxWait = 120000; // 120 seconds for model loading (can be slow on CPU)
        const startTime = Date.now();

        while (!this.embeddingServerReady && Date.now() - startTime < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this.embeddingServerReady) {
            throw new Error('Embedding server failed to start within timeout');
        }

        console.log('[EmbeddingServer] Server ready!');
    }

    /**
     * Stop the embedding server
     */
    private async stopEmbeddingServer(): Promise<void> {
        if (this.embeddingServer) {
            console.log('[EmbeddingServer] Stopping server...');
            this.embeddingServer.kill();
            this.embeddingServer = null;
            this.embeddingServerReady = false;
        }
    }

    // =============================================================================
    // Private Helper Methods
    // =============================================================================

    private ensureConnected(): void {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }
    }

    /**
     * Get the path to the virtual environment's Python interpreter
     * Handles platform differences (Windows vs Unix-like systems)
     */
    private getPythonPath(): string {
        // From dist/storage/, go up two levels to project root, then into .venv
        const isWindows = process.platform === 'win32';
        const pythonBin = isWindows ? 'Scripts/python.exe' : 'bin/python';
        return join(__dirname, '..', '..', '.venv', pythonBin);
    }

    private async encodeQueryText(
        query: string,
        model: string = 'Qwen/Qwen3-Embedding-0.6B'
    ): Promise<number[]> {
        // Fail fast if embedding server is not ready
        if (!this.embeddingServerReady) {
            throw new Error(
                'Embedding server is not running. Semantic search requires the embedding server to be started. ' +
                'Ensure the server started successfully during connect().'
            );
        }

        // Call embedding server via HTTP (no fallback - fail fast)
        const response = await fetch(`http://127.0.0.1:${this.embeddingServerPort}/encode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            throw new Error(`Embedding server returned error: HTTP ${response.status}`);
        }

        const result = await response.json() as { error?: string; embedding?: number[] };

        if (result.error) {
            throw new Error(`Embedding server error: ${result.error}`);
        }

        if (!result.embedding) {
            throw new Error('Embedding server returned invalid response: missing embedding');
        }

        return result.embedding;
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            magnitudeA += a[i] * a[i];
            magnitudeB += b[i] * b[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    private get(sql: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db!.get(sql, params, (error, row) => {
                if (error) {
                    reject(new Error(`Query failed: ${error.message}`));
                } else {
                    resolve(row);
                }
            });
        });
    }

    private all(sql: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db!.all(sql, params, (error, rows) => {
                if (error) {
                    reject(new Error(`Query failed: ${error.message}`));
                } else {
                    resolve(rows || []);
                }
            });
        });
    }
}
