#!/usr/bin/env node
/**
 * Athens HDL MCP - Entry Point
 *
 * MCP server providing AI agents with efficient access to HDL Language Reference Manuals
 * (Verilog, SystemVerilog, VHDL) via semantic search and AI summarization.
 *
 * Tools:
 *   - search_lrm: Semantic search across LRM content
 *   - get_section: Retrieve complete section content
 *   - list_sections: Get table of contents
 *   - search_code: Find code examples
 *   - get_table: Retrieve tables from sections
 *
 * @see docs/ARCHITECTURE.md for implementation details
 */

import { HDLMCPServer } from './server/mcp-server.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const DB_PATH = join(__dirname, '../data/hdl-lrm.db');

// =============================================================================
// Start Server
// =============================================================================

const server = new HDLMCPServer(DB_PATH);

server.start().catch((error) => {
    console.error('[Athens HDL MCP] Fatal error:', error);
    process.exit(1);
});
