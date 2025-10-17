/**
 * Section Handler
 * Handles section retrieval and navigation
 */

import { HDLDatabase } from '../storage/database.js';

export async function handleGetSection(db: HDLDatabase, args: any) {
    const { section_number, language, include_code = false } = args;

    const section = await db.getSection(section_number, language, include_code);

    if (!section) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `Section ${section_number} not found in ${language} LRM.`,
                },
            ],
        };
    }

    // Get subsections
    const subsections = await db.getSubsections(section_number, language);

    // Format response
    let response = `# Section ${section.section_number}: ${section.title}\n\n`;
    response += `**Language:** ${language}\n`;
    response += `**Pages:** ${section.page_start}-${section.page_end}\n`;
    response += `**Depth:** ${section.depth}\n\n`;
    response += '---\n\n';
    response += `## Content\n\n${section.content}\n\n`;

    // Add code examples if requested
    if (include_code && (section as any).code_examples?.length > 0) {
        response += '---\n\n';
        response += '## Code Examples\n\n';
        for (const code of (section as any).code_examples) {
            if (code.description) {
                response += `**${code.description}**\n\n`;
            }
            response += '```' + language + '\n';
            response += code.code + '\n';
            response += '```\n\n';
        }
    }

    // Add subsections if any
    if (subsections.length > 0) {
        response += '---\n\n';
        response += '## Subsections\n\n';
        for (const sub of subsections) {
            response += `- ${sub.number}: ${sub.title}\n`;
        }
        response += '\n';
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

export async function handleListSections(db: HDLDatabase, args: any) {
    const { language, parent = null, max_depth = 2 } = args;

    const sections = await db.listSections(language, parent, max_depth);

    if (sections.length === 0) {
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `No sections found${parent ? ` under ${parent}` : ''} in ${language} LRM.`,
                },
            ],
        };
    }

    // Format response
    let response = `# Table of Contents\n\n`;
    response += `**Language:** ${language}\n`;
    if (parent) {
        response += `**Parent:** ${parent}\n`;
    }
    response += `**Sections:** ${sections.length}\n\n`;
    response += '---\n\n';

    for (const section of sections) {
        const indent = '  '.repeat(section.depth);
        const marker = section.has_subsections ? '▸' : '•';
        response += `${indent}${marker} **${section.number}** ${section.title}\n`;
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
