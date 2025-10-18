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
                'Semantic search across LRM content using AI embeddings. Finds conceptually similar sections even if exact keywords don\'t match. Supports JSON format for agent-native structured responses.',
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
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured agent-native responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                    fields: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional: only return specified fields (e.g., ["section_number", "title", "page"] for discovery queries with 80-95% token savings). Available fields: section_number, title, page, similarity, content, depth',
                    },
                    max_content_length: {
                        type: 'number',
                        description: 'Maximum characters per section content (optional). Use to control response size. Default: return full content.',
                    },
                },
                required: ['query', 'language'],
            },
        },
        {
            name: 'get_section',
            description:
                'Retrieve complete content of a specific section from the LRM. Supports JSON format for structured responses.',
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
                    fields: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional: only return specified fields. Available: section_number, title, language, page_start, page_end, depth, content, parent_section, sibling_sections, subsections, code_examples',
                    },
                },
                required: ['section_number', 'language'],
            },
        },
        {
            name: 'list_sections',
            description:
                'Get table of contents for a language. Returns hierarchical section list. Supports JSON format for structured responses.',
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
                    fields: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional: only return specified fields. Available: section_number, title, depth, has_subsections',
                    },
                },
                required: ['language'],
            },
        },
        {
            name: 'search_code',
            description:
                'Find code examples matching a pattern or keyword. Supports JSON format for structured responses.',
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
                    format: {
                        type: 'string',
                        enum: ['json', 'markdown'],
                        description: 'Response format: "json" for structured responses (default), or "markdown" for human-readable text',
                        default: 'json',
                    },
                    fields: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional: only return specified fields. Available: section_number, section_title, page_start, page_end, code, description, context',
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
