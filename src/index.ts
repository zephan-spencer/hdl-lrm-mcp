#!/usr/bin/env node
/**
 * Athens HDL MCP Server
 *
 * Provides AI agents with efficient access to HDL Language Reference Manuals
 * via the Model Context Protocol (MCP).
 *
 * Tools:
 *   - search_lrm: Full-text search across LRM content
 *   - get_section: Retrieve complete section content
 *   - list_sections: Get table of contents
 *   - search_code: Find code examples
 *   - get_table: Retrieve tables from sections
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { HDLDatabase } from './storage/database.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const DB_PATH = join(__dirname, '../data/hdl-lrm.db');
const SUPPORTED_LANGUAGES = ['verilog', 'systemverilog', 'vhdl'];

// =============================================================================
// MCP Server
// =============================================================================

class HDLMCPServer {
    private server: Server;
    private db: HDLDatabase;

    constructor() {
        this.server = new Server(
            {
                name: 'athens-hdl-mcp',
                version: '2.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.db = new HDLDatabase(DB_PATH);

        // Setup handlers
        this.setupToolHandlers();

        // Error handling
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };

        process.on('SIGINT', async () => {
            await this.cleanup();
            process.exit(0);
        });
    }

    private setupToolHandlers(): void {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: this.getToolDefinitions(),
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'search_lrm':
                        return await this.handleSearchLRM(args);
                    case 'get_section':
                        return await this.handleGetSection(args);
                    case 'list_sections':
                        return await this.handleListSections(args);
                    case 'search_code':
                        return await this.handleSearchCode(args);
                    case 'get_table':
                        return await this.handleGetTable(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: `Error: ${message}`,
                        },
                    ],
                };
            }
        });
    }

    private getToolDefinitions(): Tool[] {
        return [
            {
                name: 'search_lrm',
                description:
                    'Semantic search across LRM content using AI embeddings. Finds conceptually similar sections even if exact keywords don\'t match.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query or concept',
                        },
                        language: {
                            type: 'string',
                            enum: SUPPORTED_LANGUAGES,
                            description: 'HDL language: verilog, systemverilog, or vhdl',
                        },
                        max_results: {
                            type: 'number',
                            description: 'Maximum number of results (default: 5, max: 20)',
                            default: 5,
                        },
                        include_summary: {
                            type: 'boolean',
                            description: 'Include AI-generated summary and key points (default: true). Set to false for full content only.',
                            default: true,
                        },
                    },
                    required: ['query', 'language'],
                },
            },
            {
                name: 'get_section',
                description:
                    'Retrieve complete content of a specific section from the LRM.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        section_number: {
                            type: 'string',
                            description: 'Section number (e.g., "3.2.1")',
                        },
                        language: {
                            type: 'string',
                            enum: SUPPORTED_LANGUAGES,
                            description: 'HDL language',
                        },
                        include_code: {
                            type: 'boolean',
                            description: 'Include code examples from this section',
                            default: false,
                        },
                    },
                    required: ['section_number', 'language'],
                },
            },
            {
                name: 'list_sections',
                description:
                    'Get table of contents for a language. Returns hierarchical section list.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        language: {
                            type: 'string',
                            enum: SUPPORTED_LANGUAGES,
                            description: 'HDL language',
                        },
                        parent: {
                            type: 'string',
                            description: 'Show only children of this section (optional)',
                        },
                        max_depth: {
                            type: 'number',
                            description: 'Maximum depth to display (default: 2)',
                            default: 2,
                        },
                    },
                    required: ['language'],
                },
            },
            {
                name: 'search_code',
                description:
                    'Find code examples matching a pattern or keyword.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Code pattern or keyword to search',
                        },
                        language: {
                            type: 'string',
                            enum: SUPPORTED_LANGUAGES,
                            description: 'HDL language',
                        },
                        max_results: {
                            type: 'number',
                            description: 'Maximum results (default: 10)',
                            default: 10,
                        },
                        explain: {
                            type: 'boolean',
                            description: 'Include AI-generated explanation of what each code example demonstrates (default: false)',
                            default: false,
                        },
                    },
                    required: ['query', 'language'],
                },
            },
            {
                name: 'get_table',
                description:
                    'Retrieve tables from a specific section.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        section_number: {
                            type: 'string',
                            description: 'Section number (e.g., "3.2.1")',
                        },
                        language: {
                            type: 'string',
                            enum: SUPPORTED_LANGUAGES,
                            description: 'HDL language',
                        },
                    },
                    required: ['section_number', 'language'],
                },
            },
        ];
    }

    // =============================================================================
    // Tool Implementations
    // =============================================================================

    private async handleSearchLRM(args: any) {
        const { query, language, max_results = 5, include_summary = true } = args;

        this.validateLanguage(language);

        // Use semantic search with optional summaries
        const results = await this.db.semanticSearchByTextWithSummaries(
            query,
            language,
            Math.min(max_results, 20),
            include_summary
        );

        if (results.length === 0) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `No results found for "${query}" in ${language} LRM.\n\nNote: Ensure embeddings have been generated for ${language} using:\npython src/embeddings/generate_embeddings.py --language ${language}`,
                    },
                ],
            };
        }

        // Format response
        let response = `# Semantic Search Results: "${query}"\n\n`;
        response += `**Language:** ${language}\n`;
        response += `**Search Type:** AI Semantic Search${include_summary ? ' + AI Summary' : ''}\n`;
        response += `**Found:** ${results.length} conceptually similar section(s)\n\n`;
        response += '---\n\n';

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            response += `## ${i + 1}. Section ${result.section_number}: ${result.title}\n\n`;
            response += `📍 Page ${result.page_start} | 🎯 Similarity: ${(result.similarity * 100).toFixed(1)}%\n\n`;

            // Add AI summary if available
            if (result.summary) {
                response += `**AI Summary:**\n${result.summary}\n\n`;
            }

            // Add key points if available
            if (result.key_points && result.key_points.length > 0) {
                response += `**Key Points:**\n`;
                for (const point of result.key_points) {
                    response += `• ${point}\n`;
                }
                response += '\n';
            }

            // Add preview (truncated)
            if (include_summary) {
                response += `**Full Preview:**\n${result.content.substring(0, 200)}...\n\n`;
            } else {
                response += `**Preview:**\n${result.content}...\n\n`;
            }

            // Add action hints
            response += `→ Use get_section("${result.section_number}") for complete details\n`;
            response += `→ Use search_code() for examples\n\n`;

            response += '---\n\n';
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: response,
                },
            ],
        };
    }

    private async handleGetSection(args: any) {
        const { section_number, language, include_code = false } = args;

        this.validateLanguage(language);

        const section = await this.db.getSection(section_number, language, include_code);

        if (!section) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `Section ${section_number} not found in ${language} LRM.`,
                    },
                ],
            };
        }

        // Get subsections
        const subsections = await this.db.getSubsections(section_number, language);

        // Format response
        let response = `# Section ${section.section_number}: ${section.title}\n\n`;
        response += `**Language:** ${language}\n`;
        response += `**Pages:** ${section.page_start}-${section.page_end}\n`;
        response += `**Depth:** ${section.depth}\n\n`;
        response += '---\n\n';
        response += `## Content\n\n${section.content}\n\n`;

        // Add code examples if requested
        if (include_code && (section as any).code_examples?.length > 0) {
            response += '---\n\n';
            response += '## Code Examples\n\n';
            for (const code of (section as any).code_examples) {
                if (code.description) {
                    response += `**${code.description}**\n\n`;
                }
                response += '```' + language + '\n';
                response += code.code + '\n';
                response += '```\n\n';
            }
        }

        // Add subsections if any
        if (subsections.length > 0) {
            response += '---\n\n';
            response += '## Subsections\n\n';
            for (const sub of subsections) {
                response += `- ${sub.number}: ${sub.title}\n`;
            }
            response += '\n';
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: response,
                },
            ],
        };
    }

    private async handleListSections(args: any) {
        const { language, parent = null, max_depth = 2 } = args;

        this.validateLanguage(language);

        const sections = await this.db.listSections(language, parent, max_depth);

        if (sections.length === 0) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `No sections found${parent ? ` under ${parent}` : ''} in ${language} LRM.`,
                    },
                ],
            };
        }

        // Format response
        let response = `# Table of Contents\n\n`;
        response += `**Language:** ${language}\n`;
        if (parent) {
            response += `**Parent:** ${parent}\n`;
        }
        response += `**Sections:** ${sections.length}\n\n`;
        response += '---\n\n';

        for (const section of sections) {
            const indent = '  '.repeat(section.depth);
            const marker = section.has_subsections ? '▸' : '•';
            response += `${indent}${marker} **${section.number}** ${section.title}\n`;
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: response,
                },
            ],
        };
    }

    private async handleSearchCode(args: any) {
        const { query, language, max_results = 10, explain = false } = args;

        this.validateLanguage(language);

        const results = await this.db.searchCodeWithExplanations(query, language, max_results, explain);

        if (results.length === 0) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `No code examples found for "${query}" in ${language} LRM.`,
                    },
                ],
            };
        }

        // Format response
        let response = `# Code Search: "${query}"\n\n`;
        response += `**Language:** ${language}\n`;
        response += `**Found:** ${results.length} example(s)${explain ? ' with AI explanations' : ''}\n\n`;
        response += '---\n\n';

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            response += `## ${i + 1}. ${result.section_number}: ${result.section_title}\n\n`;

            // Add AI explanation if available
            if ((result as any).explanation) {
                response += `**AI Explanation:**\n${(result as any).explanation}\n\n`;
            }

            if (result.description) {
                response += `**Description:** ${result.description}\n\n`;
            }
            response += '```' + language + '\n';
            response += result.code + '\n';
            response += '```\n\n';
            response += '---\n\n';
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: response,
                },
            ],
        };
    }

    private async handleGetTable(args: any) {
        const { section_number, language } = args;

        this.validateLanguage(language);

        const tables = await this.db.getTables(section_number, language);

        if (tables.length === 0) {
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: `No tables found in section ${section_number} of ${language} LRM.`,
                    },
                ],
            };
        }

        // Format response
        let response = `# Tables from Section ${section_number}\n\n`;
        response += `**Language:** ${language}\n`;
        response += `**Tables:** ${tables.length}\n\n`;
        response += '---\n\n';

        for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            response += `## Table ${i + 1}\n\n`;
            if (table.caption) {
                response += `**${table.caption}**\n\n`;
            }
            response += table.markdown + '\n\n';
            response += '---\n\n';
        }

        return {
            content: [
                {
                    type: 'text' as const,
                    text: response,
                },
            ],
        };
    }

    // =============================================================================
    // Utilities
    // =============================================================================

    private validateLanguage(language: string): void {
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new Error(
                `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
            );
        }
    }

    async start(): Promise<void> {
        // Connect to database
        await this.db.connect();

        // Get stats
        const stats = await this.db.getStats();
        console.error('[Athens HDL MCP] Connected to database');
        console.error(`[Athens HDL MCP] Sections: ${stats.sections}, Code: ${stats.code_examples}, Tables: ${stats.tables}`);

        // Start MCP server
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('[Athens HDL MCP] Server running on stdio');
    }

    async cleanup(): Promise<void> {
        await this.db.close();
        console.error('[Athens HDL MCP] Shutdown complete');
    }
}

// =============================================================================
// Entry Point
// =============================================================================

const server = new HDLMCPServer();
server.start().catch((error) => {
    console.error('[Athens HDL MCP] Fatal error:', error);
    process.exit(1);
});
