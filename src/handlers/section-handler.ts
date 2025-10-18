/**
 * Section Handler
 * Handles section retrieval and navigation
 */

import { HDLDatabase, SectionInfo } from '../storage/database.js';
import {
    createMetadata,
    formatSectionResponse,
    formatSectionListResponse,
    formatErrorResponse,
    SectionResponse,
    SectionListResponse,
    ErrorResponse,
} from '../utils/formatters.js';

export async function handleGetSection(db: HDLDatabase, args: any) {
    const { section_number, language, include_code = false, format = 'json' } = args;

    const section = await db.getSection(section_number, language, include_code);

    if (!section) {
        // Structured error response
        const errorResponse: ErrorResponse = {
            error: 'section_not_found',
            message: `Section ${section_number} not found in ${language} LRM.`,
            suggestions: [
                {
                    action: 'use_tool',
                    tool: 'list_sections',
                    params: { language },
                    description: 'Use list_sections() to browse available sections'
                },
                {
                    action: 'use_tool',
                    tool: 'search_lrm',
                    params: { language, query: section_number },
                    description: 'Use search_lrm() to find sections by topic'
                },
                {
                    action: 'check_format',
                    description: 'Check section number format (e.g., "9.2.1" not "9-2-1")'
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

    // Get parent section info if this section has a parent
    let parentSection = null;
    if (section.parent_section) {
        parentSection = await db.getSection(section.parent_section, language, false);
    }

    // Get sibling sections (sections with the same parent)
    let siblings: SectionInfo[] = [];
    if (section.parent_section) {
        siblings = await db.getSubsections(section.parent_section, language);
    }

    // Get subsections
    const subsections = await db.getSubsections(section_number, language);

    // Build structured response
    const sectionResponse: SectionResponse = {
        metadata: createMetadata('get_section'),
        section: {
            section_number: section.section_number,
            title: section.title,
            language: language,
            page_start: section.page_start,
            page_end: section.page_end,
            depth: section.depth,
            content: section.content,
            parent_section: parentSection ? {
                section_number: parentSection.section_number,
                title: parentSection.title
            } : undefined,
            sibling_sections: siblings.length > 1 ? siblings.map(s => ({
                section_number: s.number,
                title: s.title,
                is_current: s.number === section_number
            })) : undefined,
            subsections: subsections.length > 0 ? subsections.map(s => ({
                section_number: s.number,
                title: s.title,
                has_subsections: s.has_subsections
            })) : undefined,
            code_examples: include_code && (section as any).code_examples ? (section as any).code_examples.map((c: any) => ({
                code: c.code,
                description: c.description || undefined
            })) : undefined
        }
    };

    return {
        content: [
            {
                type: 'text' as const,
                text: formatSectionResponse(sectionResponse, format),
            },
        ],
    };
}

export async function handleListSections(db: HDLDatabase, args: any) {
    const { language, parent = null, max_depth = 2, search_filter, format = 'json' } = args;

    const sections = await db.listSections(language, parent, max_depth, search_filter);

    if (sections.length === 0) {
        // Structured error response
        let message = `No sections found`;
        if (search_filter) {
            message += ` matching "${search_filter}"`;
        }
        if (parent) {
            message += ` under ${parent}`;
        }
        message += ` in ${language} LRM.`;

        const errorResponse: ErrorResponse = {
            error: 'no_sections',
            message,
            suggestions: [
                {
                    action: 'broaden_search',
                    description: 'Try broader search terms'
                },
                {
                    action: 'use_tool',
                    tool: 'search_lrm',
                    params: { language, query: search_filter || '' },
                    description: 'Use search_lrm() for semantic search'
                }
            ],
            language
        };

        if (search_filter) {
            errorResponse.suggestions.push({
                action: 'remove_filter',
                description: 'Remove search_filter to see all sections'
            });
        }

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
    const listResponse: SectionListResponse = {
        language,
        parent: parent || undefined,
        search_filter: search_filter || undefined,
        metadata: createMetadata('list_sections', sections.length, sections.length),
        sections: sections.map(s => ({
            section_number: s.number,
            title: s.title,
            depth: s.depth,
            has_subsections: s.has_subsections
        }))
    };

    return {
        content: [
            {
                type: 'text' as const,
                text: formatSectionListResponse(listResponse, format),
            },
        ],
    };
}
