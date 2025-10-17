/**
 * Athens HDL MCP Server
 * Main server class that handles MCP protocol and tool routing
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { HDLDatabase } from '../storage/database.js';
import { getToolDefinitions, SUPPORTED_LANGUAGES } from './tool-definitions.js';
import { handleSearchLRM } from '../handlers/search-handler.js';
import { handleGetSection, handleListSections } from '../handlers/section-handler.js';
import { handleSearchCode } from '../handlers/code-handler.js';
import { handleGetTable } from '../handlers/table-handler.js';

export class HDLMCPServer {
    private server: Server;
    private db: HDLDatabase;
    private dbPath: string;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
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

        this.db = new HDLDatabase(dbPath);

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
            tools: getToolDefinitions(),
        }));

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                // Ensure args exists
                const toolArgs = args || {};

                // Validate language if present
                if ('language' in toolArgs && !SUPPORTED_LANGUAGES.includes(toolArgs.language as string)) {
                    throw new Error(
                        `Unsupported language: ${toolArgs.language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
                    );
                }

                // Route to appropriate handler
                switch (name) {
                    case 'search_lrm':
                        return await handleSearchLRM(this.db, toolArgs);
                    case 'get_section':
                        return await handleGetSection(this.db, toolArgs);
                    case 'list_sections':
                        return await handleListSections(this.db, toolArgs);
                    case 'search_code':
                        return await handleSearchCode(this.db, toolArgs);
                    case 'get_table':
                        return await handleGetTable(this.db, toolArgs);
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
