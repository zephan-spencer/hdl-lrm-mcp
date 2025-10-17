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

export { SUPPORTED_LANGUAGES };
