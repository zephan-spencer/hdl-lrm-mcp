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
    const { query, language, max_results = 10, format = 'json', include_context = false } = args;

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
                    text: formatErrorResponse(errorResponse, format),
                },
            ],
        };
    }

    // Get section details for each code example to add page numbers and optionally context
    const enrichedResults = await Promise.all(
        results.map(async (result) => {
            const section = await db.getSection(result.section_number, language, false);
            const enriched: any = {
                section_number: result.section_number,
                section_title: result.section_title,
                page_start: section?.page_start,
                page_end: section?.page_end,
                code: result.code,
                description: result.description || undefined
            };

            // Only add context if explicitly requested (saves tokens)
            if (include_context && section?.content) {
                enriched.context = section.content.substring(0, 200) + '...';
            }

            return enriched;
        })
    );

    // Build structured response
    const codeResponse: CodeSearchResponse = {
        query,
        language,
        metadata: createMetadata('search_code', enrichedResults.length, enrichedResults.length),
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
