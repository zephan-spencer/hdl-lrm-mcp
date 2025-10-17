/**
 * Athens HDL MCP - Database Access Layer
 *
 * Provides typed interface for querying the HDL LRM database
 */

import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { exec } from 'child_process';
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
}

export interface SemanticSearchResult {
    section_number: string;
    title: string;
    content: string;
    page_start: number;
    similarity: number;
}

export interface SemanticSearchResultWithSummary extends SemanticSearchResult {
    summary?: string;
    key_points?: string[];
}

export interface CodeSearchResultWithExplanation extends CodeSearchResult {
    explanation?: string;
}

// =============================================================================
// Database Class
// =============================================================================

export class HDLDatabase {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    /**
     * Connect to the database
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (error) => {
                if (error) {
                    reject(new Error(`Failed to connect to database: ${error.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
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
        maxDepth: number = 2
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
                ORDER BY section_number
            `;
            params = [language, parent, maxDepth];
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
                ORDER BY section_number
            `;
            params = [language, language, maxDepth];
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
                s.title AS section_title
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
                content: row.content.substring(0, 500), // Truncate for preview
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
    // Private Helper Methods
    // =============================================================================

    private ensureConnected(): void {
        if (!this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }
    }

    private async encodeQueryText(
        query: string,
        model: string = 'Qwen/Qwen3-Embedding-0.6B'
    ): Promise<number[]> {
        const execPromise = promisify(exec);
        // From dist/storage/, go up two levels and into src/embeddings/
        const scriptPath = join(__dirname, '..', '..', 'src', 'embeddings', 'encode_query.py');

        try {
            const { stdout } = await execPromise(
                `python "${scriptPath}" "${query.replace(/"/g, '\\"')}" --model ${model}`
            );

            const result = JSON.parse(stdout);

            if (result.error) {
                throw new Error(result.error);
            }

            return result.embedding;
        } catch (error) {
            throw new Error(`Failed to encode query: ${error}`);
        }
    }

    /**
     * Call Python summarizer to generate summaries or key points
     */
    private async callSummarizer(
        text: string,
        mode: 'summary' | 'keypoints' | 'explain',
        options?: {
            language?: string;
            maxLength?: number;
            maxPoints?: number;
        }
    ): Promise<any> {
        const execPromise = promisify(exec);
        const scriptPath = join(__dirname, '..', '..', 'src', 'summarization', 'summarize.py');

        // Build command
        let command = `python "${scriptPath}" "${text.replace(/"/g, '\\"')}" --mode ${mode}`;

        if (options?.language) {
            command += ` --language ${options.language}`;
        }
        if (options?.maxLength) {
            command += ` --max-length ${options.maxLength}`;
        }
        if (options?.maxPoints) {
            command += ` --max-points ${options.maxPoints}`;
        }

        try {
            const { stdout } = await execPromise(command);
            const result = JSON.parse(stdout);

            if (result.error) {
                throw new Error(result.error);
            }

            return result;
        } catch (error) {
            // Log error but don't fail the whole operation
            console.error(`[Summarizer] Failed to generate ${mode}:`, error);
            return null;
        }
    }

    /**
     * Semantic search with optional AI-generated summaries
     */
    async semanticSearchByTextWithSummaries(
        queryText: string,
        language: string,
        maxResults: number = 5,
        includeSummary: boolean = true,
        model: string = 'Qwen/Qwen3-Embedding-0.6B'
    ): Promise<SemanticSearchResultWithSummary[]> {
        // Get base semantic search results
        const baseResults = await this.semanticSearchByText(queryText, language, maxResults, model);

        if (!includeSummary) {
            return baseResults;
        }

        // Add summaries and key points to each result
        const resultsWithSummaries = await Promise.all(
            baseResults.map(async (result) => {
                try {
                    // Generate summary and key points in parallel
                    const [summaryResult, keyPointsResult] = await Promise.all([
                        this.callSummarizer(result.content, 'summary', { maxLength: 150 }),
                        this.callSummarizer(result.content, 'keypoints', { maxPoints: 3 })
                    ]);

                    return {
                        ...result,
                        summary: summaryResult?.summary || undefined,
                        key_points: keyPointsResult?.key_points || undefined
                    };
                } catch (error) {
                    // If summarization fails, return result without summary
                    console.error(`[Summarizer] Failed for section ${result.section_number}:`, error);
                    return result;
                }
            })
        );

        return resultsWithSummaries;
    }

    /**
     * Search code examples with optional AI explanations
     */
    async searchCodeWithExplanations(
        query: string,
        language: string,
        maxResults: number = 10,
        explain: boolean = false
    ): Promise<CodeSearchResultWithExplanation[]> {
        // Get base code search results
        const baseResults = await this.searchCode(query, language, maxResults);

        if (!explain) {
            return baseResults;
        }

        // Add explanations to each code example
        const resultsWithExplanations = await Promise.all(
            baseResults.map(async (result) => {
                try {
                    const explanationResult = await this.callSummarizer(
                        result.code,
                        'explain',
                        { language, maxLength: 100 }
                    );

                    return {
                        ...result,
                        explanation: explanationResult?.explanation || undefined
                    };
                } catch (error) {
                    console.error(`[Summarizer] Failed to explain code:`, error);
                    return result;
                }
            })
        );

        return resultsWithExplanations;
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
