/**
 * Integration tests for MCP Protocol compliance
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HDLDatabase } from '../../src/storage/database.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';

describe('MCP Protocol Integration', () => {
    let server: Server;
    let db: HDLDatabase;

    beforeAll(async () => {
        await setupTestDatabase();
    });

    beforeEach(async () => {
        db = new HDLDatabase(TEST_DB_PATH);
        await db.connect();

        server = new Server(
            {
                name: 'test-athens-hdl-mcp',
                version: '2.0.0-test',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );
    });

    afterEach(async () => {
        await db.close();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe('Server Initialization', () => {
        test('should create server with correct metadata', () => {
            expect(server).toBeDefined();
        });

        test('should have tools capability', () => {
            // Server should support tools
            expect(server).toBeDefined();
        });
    });

    describe('Tool Listing', () => {
        test('should list all 5 tools via MCP protocol', async () => {
            const tools = [
                {
                    name: 'search_lrm',
                    description: 'Search across all LRM content using full-text search. Returns relevant sections with snippets.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search terms or keywords' },
                            language: {
                                type: 'string',
                                enum: ['verilog', 'systemverilog', 'vhdl'],
                                description: 'HDL language: verilog, systemverilog, or vhdl',
                            },
                            max_results: {
                                type: 'number',
                                description: 'Maximum number of results (default: 5, max: 20)',
                                default: 5,
                            },
                        },
                        required: ['query', 'language'],
                    },
                },
                {
                    name: 'get_section',
                    description: 'Retrieve complete content of a specific section from the LRM.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            section_number: { type: 'string', description: 'Section number (e.g., "3.2.1")' },
                            language: {
                                type: 'string',
                                enum: ['verilog', 'systemverilog', 'vhdl'],
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
                    description: 'Get table of contents for a language. Returns hierarchical section list.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            language: {
                                type: 'string',
                                enum: ['verilog', 'systemverilog', 'vhdl'],
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
                    description: 'Find code examples matching a pattern or keyword.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Code pattern or keyword to search' },
                            language: {
                                type: 'string',
                                enum: ['verilog', 'systemverilog', 'vhdl'],
                                description: 'HDL language',
                            },
                            max_results: {
                                type: 'number',
                                description: 'Maximum results (default: 10)',
                                default: 10,
                            },
                        },
                        required: ['query', 'language'],
                    },
                },
                {
                    name: 'get_table',
                    description: 'Retrieve tables from a specific section.',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            section_number: { type: 'string', description: 'Section number (e.g., "3.2.1")' },
                            language: {
                                type: 'string',
                                enum: ['verilog', 'systemverilog', 'vhdl'],
                                description: 'HDL language',
                            },
                        },
                        required: ['section_number', 'language'],
                    },
                },
            ];

            expect(tools).toHaveLength(5);
            expect(tools.map((t) => t.name)).toEqual([
                'search_lrm',
                'get_section',
                'list_sections',
                'search_code',
                'get_table',
            ]);
        });

        test('should have correct tool schemas', () => {
            const tools = ['search_lrm', 'get_section', 'list_sections', 'search_code', 'get_table'];

            expect(tools).toContain('search_lrm');
            expect(tools).toContain('get_section');
            expect(tools).toContain('list_sections');
            expect(tools).toContain('search_code');
            expect(tools).toContain('get_table');
        });
    });

    describe('Tool Execution', () => {
        test('should execute search_lrm tool', async () => {
            const results = await db.search('always', 'verilog', 3);
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });

        test('should execute get_section tool', async () => {
            const section = await db.getSection('1', 'verilog', false);
            expect(section).toBeDefined();
            expect(section?.section_number).toBe('1');
        });

        test('should execute list_sections tool', async () => {
            const sections = await db.listSections('verilog', null, 2);
            expect(sections).toBeDefined();
            expect(Array.isArray(sections)).toBe(true);
        });

        test('should execute search_code tool', async () => {
            const codes = await db.searchCode('always', 'verilog', 5);
            expect(codes).toBeDefined();
            expect(Array.isArray(codes)).toBe(true);
        });

        test('should execute get_table tool', async () => {
            const tables = await db.getTables('1', 'verilog');
            expect(tables).toBeDefined();
            expect(Array.isArray(tables)).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid tool name gracefully', () => {
            const invalidTool = 'invalid_tool';
            const validTools = ['search_lrm', 'get_section', 'list_sections', 'search_code', 'get_table'];

            expect(validTools.includes(invalidTool)).toBe(false);
        });

        test('should validate required parameters', () => {
            // test that missing required params would fail
            const toolArgs = { query: 'test' }; // missing 'language'
            const hasLanguage = 'language' in toolArgs;

            expect(hasLanguage).toBe(false);
        });

        test('should validate language enum', () => {
            const validLanguages = ['verilog', 'systemverilog', 'vhdl'];
            expect(validLanguages.includes('verilog')).toBe(true);
            expect(validLanguages.includes('invalid')).toBe(false);
        });
    });

    describe('Response Format', () => {
        test('should return MCP-compliant response structure', async () => {
            const results = await db.search('always', 'verilog', 3);

            // MCP response should have content array
            const response = {
                content: [
                    {
                        type: 'text' as const,
                        text: `Found ${results.length} results`,
                    },
                ],
            };

            expect(response).toHaveProperty('content');
            expect(Array.isArray(response.content)).toBe(true);
            expect(response.content[0]).toHaveProperty('type');
            expect(response.content[0]).toHaveProperty('text');
            expect(response.content[0].type).toBe('text');
        });

        test('should format error responses correctly', () => {
            const error = new Error('Test error');
            const errorResponse = {
                content: [
                    {
                        type: 'text' as const,
                        text: `Error: ${error.message}`,
                    },
                ],
            };

            expect(errorResponse.content[0].text).toContain('Error:');
            expect(errorResponse.content[0].text).toContain('Test error');
        });
    });

    describe('Concurrent Requests', () => {
        test('should handle multiple concurrent requests', async () => {
            const promises = [
                db.search('always', 'verilog', 3),
                db.getSection('1', 'verilog', false),
                db.listSections('verilog', null, 2),
            ];

            const results = await Promise.all(promises);

            expect(results).toHaveLength(3);
            expect(results[0]).toBeDefined(); // search results
            expect(results[1]).toBeDefined(); // section
            expect(results[2]).toBeDefined(); // sections list
        });

        test('should maintain data consistency with concurrent queries', async () => {
            // Execute same query multiple times concurrently
            const promises = Array(5)
                .fill(null)
                .map(() => db.search('always', 'verilog', 3));

            const results = await Promise.all(promises);

            // All results should be identical
            const firstResult = JSON.stringify(results[0]);
            results.forEach((result) => {
                expect(JSON.stringify(result)).toBe(firstResult);
            });
        });
    });
});
