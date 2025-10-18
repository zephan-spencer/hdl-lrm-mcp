/**
 * Response Formatters
 * Provides structured JSON and markdown formatting for all MCP tool responses
 */

// =============================================================================
// Response Type Definitions
// =============================================================================

export interface ResponseMetadata {
    tool: string;
    timestamp?: string;
    execution_time_ms?: number;
    total_matches?: number;
    returned?: number;
}

export interface SearchResult {
    section_number: string;
    title: string;
    page: number;
    similarity: number;
    content?: string;
    depth?: number;
}

export interface SearchResponse {
    query: string;
    language: string;
    detail_level?: string;
    metadata?: ResponseMetadata;  // Optional - omitted for minimal responses
    results: SearchResult[];
}

export interface SectionResult {
    section_number: string;
    title: string;
    language: string;
    page_start: number;
    page_end: number;
    depth: number;
    content?: string;
    parent_section?: {
        section_number: string;
        title: string;
    };
    sibling_sections?: Array<{
        section_number: string;
        title: string;
        is_current: boolean;
    }>;
    subsections?: Array<{
        section_number: string;
        title: string;
        has_subsections: boolean;
    }>;
    code_examples?: Array<{
        code: string;
        description?: string;
    }>;
}

export interface SectionResponse {
    metadata?: ResponseMetadata;
    section: SectionResult;
}

export interface SectionListItem {
    section_number: string;
    title: string;
    depth: number;
    has_subsections: boolean;
}

export interface SectionListResponse {
    language: string;
    parent?: string;
    search_filter?: string;
    detail_level?: string;
    metadata?: ResponseMetadata;
    sections: SectionListItem[];
}

export interface CodeResult {
    section_number: string;
    section_title: string;
    page_start?: number;
    page_end?: number;
    code: string;
    description?: string;
    context?: string;
}

export interface CodeSearchResponse {
    query: string;
    language: string;
    metadata?: ResponseMetadata;
    results: CodeResult[];
}

export interface TableResult {
    caption?: string;
    markdown: string;
    content_json: any;
}

export interface TableResponse {
    section_number: string;
    language: string;
    metadata?: ResponseMetadata;
    tables: TableResult[];
}

export interface ErrorResponse {
    error: string;
    message: string;
    suggestions: Array<{
        action: string;
        description: string;
        tool?: string;
        params?: Record<string, any>;
    }>;
    query?: string;
    language?: string;
    section_number?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================


/**
 * Create metadata for responses
 */
export function createMetadata(
    tool: string,
    totalMatches?: number,
    returned?: number
): ResponseMetadata {
    return {
        tool,
        timestamp: new Date().toISOString(),
        total_matches: totalMatches,
        returned: returned ?? totalMatches,
    };
}

// =============================================================================
// Search Formatters
// =============================================================================

export function formatSearchResponse(
    response: SearchResponse,
    format: 'json' | 'markdown' = 'json'
): string {
    if (format === 'json') {
        // For minimal responses, omit metadata wrapper to save tokens
        if (response.detail_level === 'minimal') {
            return JSON.stringify({
                query: response.query,
                language: response.language,
                results: response.results
            }, null, 2);
        }
        return JSON.stringify(response, null, 2);
    }

    // Markdown format - optimized, no emojis
    let md = `# Search Results: "${response.query}"\n\n`;
    md += `Language: ${response.language} | Found: ${response.results.length} section(s)\n\n`;

    for (let i = 0; i < response.results.length; i++) {
        const result = response.results[i];
        md += `## ${i + 1}. ${result.section_number}: ${result.title}\n\n`;
        md += `Page ${result.page} | Similarity: ${(result.similarity * 100).toFixed(1)}%\n\n`;

        if ('content_preview' in result) {
            md += `**Preview:** ${(result as any).content_preview}\n\n`;
        }

        if (result.content) {
            md += `**Content:**\n${result.content}\n\n`;
        }

        if (i < response.results.length - 1) {
            md += '---\n\n';
        }
    }

    return md;
}

// =============================================================================
// Section Formatters
// =============================================================================

export function formatSectionResponse(
    response: SectionResponse,
    format: 'json' | 'markdown' = 'json'
): string {
    if (format === 'json') {
        return JSON.stringify(response, null, 2);
    }

    // Markdown format
    const s = response.section;
    let md = `# Section ${s.section_number}: ${s.title}\n\n`;
    md += `Language: ${s.language} | Pages: ${s.page_start}-${s.page_end} | Depth: ${s.depth}\n\n`;

    if (s.parent_section) {
        md += `**Parent Section:** ${s.parent_section.section_number}: ${s.parent_section.title}\n\n`;
    }

    if (s.sibling_sections && s.sibling_sections.length > 1) {
        md += `**Sibling Sections:**\n`;
        for (const sibling of s.sibling_sections) {
            if (sibling.is_current) {
                md += `- **${sibling.section_number}: ${sibling.title}** (current)\n`;
            } else {
                md += `- ${sibling.section_number}: ${sibling.title}\n`;
            }
        }
        md += '\n';
    }

    if (s.content) {
        md += `## Content\n\n${s.content}\n\n`;
    }

    if (s.code_examples && s.code_examples.length > 0) {
        md += '---\n\n';
        md += `## Code Examples (${s.code_examples.length})\n\n`;
        for (const code of s.code_examples) {
            if (code.description) {
                md += `**${code.description}**\n\n`;
            }
            md += '```' + s.language + '\n';
            md += code.code + '\n';
            md += '```\n\n';
        }
    }

    if (s.subsections && s.subsections.length > 0) {
        md += '---\n\n';
        md += `## Subsections (${s.subsections.length})\n\n`;
        for (const sub of s.subsections) {
            const marker = sub.has_subsections ? '▸' : '•';
            md += `${marker} ${sub.section_number}: ${sub.title}\n`;
        }
        md += '\n';
    }

    return md;
}

// =============================================================================
// Section List Formatters
// =============================================================================

export function formatSectionListResponse(
    response: SectionListResponse,
    format: 'json' | 'markdown' = 'json'
): string {
    if (format === 'json') {
        return JSON.stringify(response, null, 2);
    }

    // Markdown format - optimized, no emojis
    let md = `# Table of Contents\n\n`;
    md += `Language: ${response.language}`;
    if (response.parent) {
        md += ` | Parent: ${response.parent}`;
    }
    if (response.search_filter) {
        md += ` | Filter: "${response.search_filter}"`;
    }
    md += ` | Found: ${response.sections.length}\n\n`;

    for (const section of response.sections) {
        const indent = '  '.repeat(section.depth);
        const marker = section.has_subsections ? '>' : '-';
        md += `${indent}${marker} **${section.section_number}** ${section.title}\n`;
    }

    return md;
}

// =============================================================================
// Code Search Formatters
// =============================================================================

export function formatCodeSearchResponse(
    response: CodeSearchResponse,
    format: 'json' | 'markdown' = 'json'
): string {
    if (format === 'json') {
        return JSON.stringify(response, null, 2);
    }

    // Markdown format
    let md = `# Code Search: "${response.query}"\n\n`;
    md += `Language: ${response.language} | Found: ${response.results.length} example(s)\n\n`;

    for (let i = 0; i < response.results.length; i++) {
        const result = response.results[i];
        md += `## ${i + 1}. ${result.section_number}: ${result.section_title}\n\n`;

        if (result.page_start) {
            md += `Pages: ${result.page_start}-${result.page_end}`;
            const codeLength = result.code.length;
            if (codeLength > 500) {
                md += ` | Code length: ${codeLength} chars`;
            }
            md += '\n\n';
        }

        if (result.context) {
            md += `**Context:** ${result.context}\n\n`;
        }

        if (result.description) {
            md += `${result.description}\n\n`;
        }

        md += '```' + response.language + '\n';
        md += result.code + '\n';
        md += '```\n\n';

        if (i < response.results.length - 1) {
            md += '---\n\n';
        }
    }

    return md;
}

// =============================================================================
// Table Formatters
// =============================================================================

export function formatTableResponse(
    response: TableResponse,
    format: 'json' | 'markdown' = 'json'
): string {
    if (format === 'json') {
        return JSON.stringify(response, null, 2);
    }

    // Markdown format
    let md = `# Tables from Section ${response.section_number}\n\n`;
    md += `Language: ${response.language} | Found: ${response.tables.length} table(s)\n\n`;

    for (let i = 0; i < response.tables.length; i++) {
        const table = response.tables[i];
        if (table.caption) {
            md += `## ${i + 1}. ${table.caption}\n\n`;
        } else {
            md += `## ${i + 1}. Table ${i + 1}\n\n`;
        }
        md += table.markdown + '\n\n';

        if (i < response.tables.length - 1) {
            md += '---\n\n';
        }
    }

    return md;
}

// =============================================================================
// Error Formatters
// =============================================================================

export function formatErrorResponse(
    response: ErrorResponse,
    format: 'json' | 'markdown' = 'json',
    verboseErrors: boolean = true
): string {
    if (format === 'json') {
        // If not verbose, omit suggestions to save tokens
        if (!verboseErrors) {
            const minimal = {
                error: response.error,
                message: response.message
            };
            return JSON.stringify(minimal, null, 2);
        }
        return JSON.stringify(response, null, 2);
    }

    // Markdown format
    let md = response.message + '\n\n';

    if (verboseErrors && response.suggestions.length > 0) {
        md += `Suggestions:\n`;
        for (const suggestion of response.suggestions) {
            md += `- ${suggestion.description}\n`;
        }
    }

    return md;
}
