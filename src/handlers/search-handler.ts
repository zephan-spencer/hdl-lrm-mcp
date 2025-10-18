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
        detail_level = 'minimal'
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

    // Build structured response based on detail_level
    const searchResponse: SearchResponse = {
        query,
        language,
        detail_level,
        metadata: detail_level === 'minimal' ? undefined : createMetadata('search_lrm', results.length, results.length),
        results: results.map(r => {
            // Minimal: only section_number, title, page, similarity
            const result: any = {
                section_number: r.section_number,
                title: r.title,
                page: r.page_start,
                similarity: r.similarity
            };

            // Preview: add first 200 chars of content
            if (detail_level === 'preview' || detail_level === 'full') {
                result.content_preview = r.content.substring(0, 200) + (r.content.length > 200 ? '...' : '');
            }

            // Full: add complete content
            if (detail_level === 'full') {
                result.content = r.content;
                delete result.content_preview; // Remove preview if full content included
            }

            return result;
        })
    };

    return {
        content: [
            {
                type: 'text' as const,
                text: formatSearchResponse(searchResponse, format),
            },
        ],
    };
}
