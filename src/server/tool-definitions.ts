/**
 * MCP Tool Definitions
 * Defines the schema for all available tools in the Athens HDL MCP server
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

const SUPPORTED_LANGUAGES = ['verilog', 'systemverilog', 'vhdl'];

export function getToolDefinitions(): Tool[] {
    return [
        {
            name: 'search_lrm',
            description:
                'Semantic search across LRM content using AI embeddings. OPTIMIZED FOR AGENT WORKFLOWS: Returns minimal data by default for efficient discovery. Use detail_level="minimal" (default) to find relevant sections with minimal tokens, then call get_section() for full content. Only use detail_level="full" if you need complete content immediately.',
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
                    detail_level: {
                        type: 'string',
                        enum: ['minimal', 'preview', 'full'],
                        description: 'Response detail level: "minimal" (default) returns only section_number, title, page, similarity (~80 bytes/result); "preview" adds 200-char content preview (~280 bytes/result); "full" returns complete content (~1000-3000 bytes/result)',
                        default: 'minimal',
                    },
                    max_results: {
                        type: 'number',
                        description: 'Maximum number of results (default: 5, max: 20). With detail_level="minimal", you can request more results (e.g., 10-15) at minimal token cost.',
                        default: 5,
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured agent-native responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                },
                required: ['query', 'language'],
            },
        },
        {
            name: 'get_section',
            description:
                'Retrieve complete content of a specific section from the LRM. Always returns full section details including content, metadata, and navigation (parent/siblings/subsections). Use this after search_lrm to get complete information about sections you discovered.',
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
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                },
                required: ['section_number', 'language'],
            },
        },
        {
            name: 'list_sections',
            description:
                'Get table of contents for a language. Returns hierarchical section list, optimized for browsing. Returns minimal data by default (section_number, title, depth, has_subsections).',
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
                    search_filter: {
                        type: 'string',
                        description: 'Filter sections by keyword in title (e.g., "timing", "assignment"). Searches across all depths when used.',
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                },
                required: ['language'],
            },
        },
        {
            name: 'search_code',
            description:
                'Find code examples matching a pattern or keyword. Returns code, section reference, and page numbers. Context is optional to save tokens.',
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
                    include_context: {
                        type: 'boolean',
                        description: 'Include 200-char section context preview (default: false to save tokens)',
                        default: false,
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                },
                required: ['query', 'language'],
            },
        },
        {
            name: 'get_table',
            description:
                'Retrieve tables from a specific section. Supports JSON format for structured responses.',
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
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                },
                required: ['section_number', 'language'],
            },
        },
    ];
}

export { SUPPORTED_LANGUAGES };
