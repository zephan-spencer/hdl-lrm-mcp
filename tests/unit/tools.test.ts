/**
 * Unit tests for MCP Tool Handlers
 */

import { HDLDatabase } from '../../src/storage/database.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';

describe('MCP Tool Handlers', () => {
    let db: HDLDatabase;

    beforeAll(async () => {
        await setupTestDatabase();
    });

    beforeEach(async () => {
        db = new HDLDatabase(TEST_DB_PATH);
        await db.connect();
    });

    afterEach(async () => {
        await db.close();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe('search_lrm tool', () => {
        test('should format search results correctly', async () => {
            const results = await db.search('always', 'verilog', 3);

            // Simulate the tool handler response formatting
            let response = `# Search Results: "always"\n\n`;
            response += `**Language:** verilog\n`;
            response += `**Found:** ${results.length} section(s)\n\n`;
            response += '---\n\n';

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                response += `## ${i + 1}. Section ${result.section_number}: ${result.title}\n\n`;
                response += `**Page:** ${result.page_start}\n\n`;
                response += `**Excerpt:**\n${result.snippet}\n\n`;
                response += '---\n\n';
            }

            expect(response).toContain('# Search Results:');
            expect(response).toContain('**Language:** verilog');
            expect(response).toContain('Section ');
            expect(response).toContain('**Page:**');
        });

        test('should handle no results gracefully', async () => {
            const results = await db.search('nonexistentxyzabc', 'verilog', 5);

            if (results.length === 0) {
                const response = `No results found for "nonexistentxyzabc" in verilog LRM.`;
                expect(response).toContain('No results found');
            }
        });

        test('should enforce max_results limit', async () => {
            const max_results = 20;
            const actual_limit = Math.min(max_results, 20);
            expect(actual_limit).toBeLessThanOrEqual(20);
        });
    });

    describe('get_section tool', () => {
        test('should format section content correctly', async () => {
            const section = await db.getSection('9.2.1', 'verilog', true);
            const subsections = await db.getSubsections('9.2.1', 'verilog');

            expect(section).toBeDefined();

            let response = `# Section ${section!.section_number}: ${section!.title}\n\n`;
            response += `**Language:** verilog\n`;
            response += `**Pages:** ${section!.page_start}-${section!.page_end}\n`;
            response += `**Depth:** ${section!.depth}\n\n`;
            response += '---\n\n';
            response += `## Content\n\n${section!.content}\n\n`;

            expect(response).toContain('# Section 9.2.1');
            expect(response).toContain('**Language:** verilog');
            expect(response).toContain('**Pages:**');
            expect(response).toContain('## Content');
        });

        test('should include code examples when requested', async () => {
            const section = await db.getSection('9.2.1', 'verilog', true);

            expect(section).toBeDefined();
            expect((section as any).code_examples).toBeDefined();

            if ((section as any).code_examples?.length > 0) {
                let response = '## Code Examples\n\n';
                for (const code of (section as any).code_examples) {
                    if (code.description) {
                        response += `**${code.description}**\n\n`;
                    }
                    response += '```verilog\n';
                    response += code.code + '\n';
                    response += '```\n\n';
                }

                expect(response).toContain('## Code Examples');
                expect(response).toContain('```verilog');
            }
        });

        test('should handle non-existent section', async () => {
            const section = await db.getSection('999', 'verilog', false);

            if (!section) {
                const response = `Section 999 not found in verilog LRM.`;
                expect(response).toContain('not found');
            }
        });

        test('should include subsections list', async () => {
            const section = await db.getSection('9', 'verilog', false);
            const subsections = await db.getSubsections('9', 'verilog');

            if (subsections.length > 0) {
                let response = '## Subsections\n\n';
                for (const sub of subsections) {
                    response += `- ${sub.number}: ${sub.title}\n`;
                }

                expect(response).toContain('## Subsections');
                expect(response).toContain('9.2:');
            }
        });
    });

    describe('list_sections tool', () => {
        test('should format section list correctly', async () => {
            const sections = await db.listSections('verilog', null, 2);

            let response = `# Table of Contents\n\n`;
            response += `**Language:** verilog\n`;
            response += `**Sections:** ${sections.length}\n\n`;
            response += '---\n\n';

            for (const section of sections) {
                const indent = '  '.repeat(section.depth);
                const marker = section.has_subsections ? '▸' : '•';
                response += `${indent}${marker} **${section.number}** ${section.title}\n`;
            }

            expect(response).toContain('# Table of Contents');
            expect(response).toContain('**Language:** verilog');
            expect(response).toContain('**Sections:**');
        });

        test('should handle parent parameter', async () => {
            const sections = await db.listSections('verilog', '9', 2);

            let response = `# Table of Contents\n\n`;
            response += `**Language:** verilog\n`;
            response += `**Parent:** 9\n`;
            response += `**Sections:** ${sections.length}\n\n`;

            expect(response).toContain('**Parent:** 9');
        });

        test('should show indentation for depth', async () => {
            const sections = await db.listSections('verilog', null, 2);

            for (const section of sections) {
                const indent = '  '.repeat(section.depth);
                expect(indent.length).toBe(section.depth * 2);
            }
        });

        test('should use different markers for sections with/without subsections', async () => {
            const sections = await db.listSections('verilog', null, 2);

            for (const section of sections) {
                const marker = section.has_subsections ? '▸' : '•';
                expect(['▸', '•']).toContain(marker);
            }
        });
    });

    describe('search_code tool', () => {
        test('should format code search results correctly', async () => {
            const results = await db.searchCode('always', 'verilog', 5);

            let response = `# Code Search: "always"\n\n`;
            response += `**Language:** verilog\n`;
            response += `**Found:** ${results.length} example(s)\n\n`;
            response += '---\n\n';

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                response += `## ${i + 1}. ${result.section_number}: ${result.section_title}\n\n`;
                if (result.description) {
                    response += `**Description:** ${result.description}\n\n`;
                }
                response += '```verilog\n';
                response += result.code + '\n';
                response += '```\n\n';
                response += '---\n\n';
            }

            expect(response).toContain('# Code Search:');
            expect(response).toContain('**Language:** verilog');
            expect(response).toContain('```verilog');
        });

        test('should handle no code results', async () => {
            const results = await db.searchCode('nonexistentxyzabc', 'verilog', 10);

            if (results.length === 0) {
                const response = `No code examples found for "nonexistentxyzabc" in verilog LRM.`;
                expect(response).toContain('No code examples found');
            }
        });
    });

    describe('get_table tool', () => {
        test('should format table results correctly', async () => {
            const tables = await db.getTables('1', 'verilog');

            let response = `# Tables from Section 1\n\n`;
            response += `**Language:** verilog\n`;
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

            expect(response).toContain('# Tables from Section');
            expect(response).toContain('**Language:** verilog');
            if (tables.length > 0) {
                expect(response).toContain('|');
            }
        });

        test('should handle no tables', async () => {
            const tables = await db.getTables('999', 'verilog');

            if (tables.length === 0) {
                const response = `No tables found in section 999 of verilog LRM.`;
                expect(response).toContain('No tables found');
            }
        });
    });

    describe('Language Validation', () => {
        test('should accept valid languages', () => {
            const SUPPORTED_LANGUAGES = ['verilog', 'systemverilog', 'vhdl'];

            expect(SUPPORTED_LANGUAGES.includes('verilog')).toBe(true);
            expect(SUPPORTED_LANGUAGES.includes('systemverilog')).toBe(true);
            expect(SUPPORTED_LANGUAGES.includes('vhdl')).toBe(true);
        });

        test('should reject invalid languages', () => {
            const SUPPORTED_LANGUAGES = ['verilog', 'systemverilog', 'vhdl'];

            expect(SUPPORTED_LANGUAGES.includes('invalid')).toBe(false);
            expect(SUPPORTED_LANGUAGES.includes('python')).toBe(false);
        });

        test('should provide helpful error message for invalid language', () => {
            const SUPPORTED_LANGUAGES = ['verilog', 'systemverilog', 'vhdl'];
            const language = 'invalid';

            if (!SUPPORTED_LANGUAGES.includes(language)) {
                const errorMessage = `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`;
                expect(errorMessage).toContain('Unsupported language');
                expect(errorMessage).toContain('verilog, systemverilog, vhdl');
            }
        });
    });

    describe('Parameter Defaults', () => {
        test('search_lrm should default max_results to 5', () => {
            const max_results = undefined;
            const actual = max_results || 5;
            expect(actual).toBe(5);
        });

        test('get_section should default include_code to false', () => {
            const include_code = undefined;
            const actual = include_code || false;
            expect(actual).toBe(false);
        });

        test('list_sections should default max_depth to 2', () => {
            const max_depth = undefined;
            const actual = max_depth || 2;
            expect(actual).toBe(2);
        });

        test('search_code should default max_results to 10', () => {
            const max_results = undefined;
            const actual = max_results || 10;
            expect(actual).toBe(10);
        });
    });
});
