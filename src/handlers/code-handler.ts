/**
 * Code Handler
 * Handles code example search and retrieval
 */

import { HDLDatabase } from '../storage/database.js';

export async function handleSearchCode(db: HDLDatabase, args: any) {
    const { query, language, max_results = 10, explain = false } = args;

    const results = await db.searchCodeWithExplanations(query, language, max_results, explain);

    if (results.length === 0) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `No code examples found for "${query}" in ${language} LRM.`,
                },
            ],
        };
    }

    // Format response
    let response = `# Code Search: "${query}"\n\n`;
    response += `**Language:** ${language}\n`;
    response += `**Found:** ${results.length} example(s)${explain ? ' with AI explanations' : ''}\n\n`;
    response += '---\n\n';

    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        response += `## ${i + 1}. ${result.section_number}: ${result.section_title}\n\n`;

        // Add AI explanation if available
        if ((result as any).explanation) {
            response += `**AI Explanation:**\n${(result as any).explanation}\n\n`;
        }

        if (result.description) {
            response += `**Description:** ${result.description}\n\n`;
        }
        response += '```' + language + '\n';
        response += result.code + '\n';
        response += '```\n\n';
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
