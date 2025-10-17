/**
 * Search Handler
 * Handles semantic search across LRM content
 */

import { HDLDatabase } from '../storage/database.js';

export async function handleSearchLRM(db: HDLDatabase, args: any) {
    const { query, language, max_results = 5, include_summary = true } = args;

    // Use semantic search with optional summaries
    const results = await db.semanticSearchByTextWithSummaries(
        query,
        language,
        Math.min(max_results, 20),
        include_summary
    );

    if (results.length === 0) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `No results found for "${query}" in ${language} LRM.\n\nNote: Ensure embeddings have been generated for ${language} using:\nsource .venv/bin/activate\npython src/embeddings/generate_embeddings.py --language ${language}`,
                },
            ],
        };
    }

    // Format response
    let response = `# Semantic Search Results: "${query}"\n\n`;
    response += `**Language:** ${language}\n`;
    response += `**Search Type:** AI Semantic Search${include_summary ? ' + AI Summary' : ''}\n`;
    response += `**Found:** ${results.length} conceptually similar section(s)\n\n`;
    response += '---\n\n';

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        response += `## ${i + 1}. Section ${result.section_number}: ${result.title}\n\n`;
        response += `📍 Page ${result.page_start} | 🎯 Similarity: ${(result.similarity * 100).toFixed(1)}%\n\n`;

        // Add AI summary if available
        if (result.summary) {
            response += `**AI Summary:**\n${result.summary}\n\n`;
        }

        // Add key points if available
        if (result.key_points && result.key_points.length > 0) {
            response += `**Key Points:**\n`;
            for (const point of result.key_points) {
                response += `• ${point}\n`;
            }
            response += '\n';
        }

        // Add preview (truncated)
        if (include_summary) {
            response += `**Full Preview:**\n${result.content.substring(0, 200)}...\n\n`;
        } else {
            response += `**Preview:**\n${result.content}...\n\n`;
        }

        // Add action hints
        response += `→ Use get_section("${result.section_number}") for complete details\n`;
        response += `→ Use search_code() for examples\n\n`;

        response += '---\n\n';
    }

    return {
        content: [
            {
                type: 'text' as const,
                text: response,
            },
        ],
    };
}
