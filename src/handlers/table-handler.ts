/**
 * Table Handler
 * Handles table retrieval from LRM sections
 */

import { HDLDatabase } from '../storage/database.js';

export async function handleGetTable(db: HDLDatabase, args: any) {
    const { section_number, language } = args;

    const tables = await db.getTables(section_number, language);

    if (tables.length === 0) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `No tables found in section ${section_number} of ${language} LRM.`,
                },
            ],
        };
    }

    // Format response
    let response = `# Tables from Section ${section_number}\n\n`;
    response += `**Language:** ${language}\n`;
    response += `**Tables:** ${tables.length}\n\n`;
    response += '---\n\n';

    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        response += `## Table ${i + 1}\n\n`;
        if (table.caption) {
            response += `**${table.caption}**\n\n`;
        }
        response += table.markdown + '\n\n';
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
