/**
 * Code Handler
 * Handles code example search and retrieval
 */

import { HDLDatabase } from '../storage/database.js';
import {
    createMetadata,
    formatCodeSearchResponse,
    formatErrorResponse,
    CodeSearchResponse,
    ErrorResponse,
} from '../utils/formatters.js';

export async function handleSearchCode(db: HDLDatabase, args: any) {
    const { query, language, max_results = 10, format = 'json', include_context = false, include_metadata = true, verbose_errors = true } = args;

    const results = await db.searchCode(query, language, max_results);

    if (results.length === 0) {
        // Structured error response
        const errorResponse: ErrorResponse = {
            error: 'no_code_examples',
            message: `No code examples found for "${query}" in ${language} LRM.`,
            suggestions: [
                {
                    action: 'broaden_search',
                    description: `Try broader search terms (e.g., "always" instead of "always @posedge")`
                },
                {
                    action: 'use_tool',
                    tool: 'search_lrm',
                    params: { language, query },
                    description: 'Use search_lrm() to find relevant sections first'
                },
                {
                    action: 'check_syntax',
                    description: `Check spelling and ${language} syntax`
                }
            ],
            query,
            language
        };

        return {
            content: [
                {
                    type: 'text' as const,
                    text: formatErrorResponse(errorResponse, format, verbose_errors),
                },
            ],
        };
    }

    // Page numbers now come directly from the query (no N+1 lookups needed!)
    // Only fetch sections if context is requested
    const enrichedResults = include_context
        ? await Promise.all(
            results.map(async (result) => {
                const section = await db.getSection(result.section_number, language, false);
                return {
                    section_number: result.section_number,
                    section_title: result.section_title,
                    page_start: result.page_start,
                    page_end: result.page_end,
                    code: result.code,
                    description: result.description || undefined,
                    context: section?.content ? section.content.substring(0, 200) + '...' : undefined
                };
            })
        )
        : results.map(result => ({
            section_number: result.section_number,
            section_title: result.section_title,
            page_start: result.page_start,
            page_end: result.page_end,
            code: result.code,
            description: result.description || undefined
        }));

    // Build structured response
    const codeResponse: CodeSearchResponse = {
        query,
        language,
        metadata: include_metadata ? createMetadata('search_code', enrichedResults.length, enrichedResults.length) : undefined as any,
        results: enrichedResults
    };

    return {
        content: [
            {
                type: 'text' as const,
                text: formatCodeSearchResponse(codeResponse, format),
            },
        ],
    };
}
