/**
 * Search Handler
 * Handles semantic search across LRM content
 */

import { HDLDatabase } from '../storage/database.js';
import {
    createMetadata,
    formatSearchResponse,
    formatErrorResponse,
    SearchResponse,
    ErrorResponse,
} from '../utils/formatters.js';

export async function handleSearchLRM(db: HDLDatabase, args: any) {
    const {
        query,
        language,
        max_results = 5,
        format = 'json',
        fields,
        max_content_length
    } = args;

    // Use semantic search
    const results = await db.semanticSearchByText(
        query,
        language,
        Math.min(max_results, 20)
    );

    if (results.length === 0) {
        // Structured error response
        const errorResponse: ErrorResponse = {
            error: 'no_results',
            message: `No results found for "${query}" in ${language} LRM.`,
            suggestions: [
                {
                    action: 'broaden_search',
                    description: 'Try broader or different search terms'
                },
                {
                    action: 'use_tool',
                    tool: 'list_sections',
                    params: { language, search_filter: query },
                    description: 'Use list_sections() with search_filter to browse by topic'
                },
                {
                    action: 'semantic_search',
                    description: 'Search for related concepts or synonyms'
                },
                {
                    action: 'generate_embeddings',
                    description: `If embeddings are missing, generate them with: python src/embeddings/generate_embeddings.py --language ${language}`
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

    // Build structured response
    const searchResponse: SearchResponse = {
        query,
        language,
        metadata: createMetadata('search_lrm', results.length, results.length),
        results: results.map(r => {
            let content = r.content;
            if (max_content_length && content.length > max_content_length) {
                content = content.substring(0, max_content_length) + '...';
            }

            return {
                section_number: r.section_number,
                title: r.title,
                page: r.page_start,
                similarity: r.similarity,
                content
            };
        })
    };

    return {
        content: [
            {
                type: 'text' as const,
                text: formatSearchResponse(searchResponse, format, fields),
            },
        ],
    };
}
