/**
 * Table Handler
 * Handles table retrieval from LRM sections
 */

import { HDLDatabase } from '../storage/database.js';
import {
    createMetadata,
    formatTableResponse,
    formatErrorResponse,
    TableResponse,
    ErrorResponse,
} from '../utils/formatters.js';

export async function handleGetTable(db: HDLDatabase, args: any) {
    const { section_number, language, format = 'json' } = args;

    const tables = await db.getTables(section_number, language);

    if (tables.length === 0) {
        // Structured error response
        const errorResponse: ErrorResponse = {
            error: 'no_tables',
            message: `No tables found in section ${section_number} of ${language} LRM.`,
            suggestions: [
                {
                    action: 'use_tool',
                    tool: 'get_section',
                    params: { section_number, language },
                    description: 'Use get_section() to view the section content'
                },
                {
                    action: 'use_tool',
                    tool: 'search_lrm',
                    params: { language, query: section_number },
                    description: 'Use search_lrm() to find sections with tables'
                },
                {
                    action: 'check_section',
                    description: 'Verify the section number exists and contains tables'
                }
            ],
            section_number,
            language
        };

        return {
            content: [
                {
                    type: 'text' as const,
                    text: formatErrorResponse(errorResponse, format),
                },
            ],
        };
    }

    // Build structured response
    const tableResponse: TableResponse = {
        section_number,
        language,
        metadata: createMetadata('get_table', tables.length, tables.length),
        tables: tables.map(t => ({
            caption: t.caption || undefined,
            markdown: t.markdown,
            content_json: t.content_json ? JSON.parse(t.content_json) : undefined
        }))
    };

    return {
        content: [
            {
                type: 'text' as const,
                text: formatTableResponse(tableResponse, format),
            },
        ],
    };
}
