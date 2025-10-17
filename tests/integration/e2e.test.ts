/**
 * End-to-end integration tests
 * Tests complete workflows from database query to formatted response
 */

import { HDLDatabase } from '../../src/storage/database.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';

describe('End-to-End Integration Tests', () => {
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

    describe('Complete Search Workflow', () => {
        test('should perform search and format results end-to-end', async () => {
            // 1. Execute search
            const query = 'always';
            const language = 'verilog';
            const results = await db.search(query, language, 3);

            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);

            // 2. Format as MCP response
            let response = `# Search Results: "${query}"\n\n`;
            response += `**Language:** ${language}\n`;
            response += `**Found:** ${results.length} section(s)\n\n`;
            response += '---\n\n';

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                response += `## ${i + 1}. Section ${result.section_number}: ${result.title}\n\n`;
                response += `**Page:** ${result.page_start}\n\n`;
                response += `**Excerpt:**\n${result.snippet}\n\n`;
                response += '---\n\n';
            }

            // 3. Verify response structure
            expect(response).toContain('# Search Results');
            expect(response).toContain('**Language:** verilog');
            expect(response).toContain('Section ');
            expect(response).toContain('**Page:**');
            expect(response).toContain('**Excerpt:**');
        });
    });

    describe('Section Retrieval with Code', () => {
        test('should retrieve section with code examples end-to-end', async () => {
            // 1. Get section
            const section = await db.getSection('9.2.1', 'verilog', true);
            expect(section).toBeDefined();

            // 2. Get subsections
            const subsections = await db.getSubsections('9.2.1', 'verilog');

            // 3. Format response
            let response = `# Section ${section!.section_number}: ${section!.title}\n\n`;
            response += `**Language:** verilog\n`;
            response += `**Pages:** ${section!.page_start}-${section!.page_end}\n`;
            response += `**Depth:** ${section!.depth}\n\n`;
            response += '---\n\n';
            response += `## Content\n\n${section!.content}\n\n`;

            if ((section as any).code_examples?.length > 0) {
                response += '---\n\n';
                response += '## Code Examples\n\n';
                for (const code of (section as any).code_examples) {
                    if (code.description) {
                        response += `**${code.description}**\n\n`;
                    }
                    response += '```verilog\n';
                    response += code.code + '\n';
                    response += '```\n\n';
                }
            }

            // 4. Verify response
            expect(response).toContain('# Section 9.2.1');
            expect(response).toContain('## Content');
            expect(response).toContain('## Code Examples');
            expect(response).toContain('```verilog');
        });
    });

    describe('Hierarchical Navigation', () => {
        test('should navigate through section hierarchy end-to-end', async () => {
            // 1. Start with top-level sections
            const topLevel = await db.listSections('verilog', null, 0);
            expect(topLevel.length).toBeGreaterThan(0);

            // 2. Get a section with subsections
            const sectionWithChildren = topLevel.find((s) => s.has_subsections);
            expect(sectionWithChildren).toBeDefined();

            // 3. Get children of that section
            const children = await db.getSubsections(sectionWithChildren!.number, 'verilog');
            expect(children.length).toBeGreaterThan(0);

            // 4. Get full content of a child
            const childSection = await db.getSection(children[0].number, 'verilog', false);
            expect(childSection).toBeDefined();
            expect(childSection?.parent_section).toBe(sectionWithChildren!.number);

            // 5. Verify hierarchy
            expect(childSection?.section_number.startsWith(sectionWithChildren!.number)).toBe(true);
        });
    });

    describe('Code Search and Retrieval', () => {
        test('should search code and retrieve context end-to-end', async () => {
            // 1. Search for code
            const codes = await db.searchCode('always', 'verilog', 5);
            expect(codes.length).toBeGreaterThan(0);

            // 2. Get context for first code example
            const firstCode = codes[0];
            const section = await db.getSection(firstCode.section_number, 'verilog', false);

            expect(section).toBeDefined();
            expect(section?.section_number).toBe(firstCode.section_number);

            // 3. Format response with context
            let response = `# Code Example\n\n`;
            response += `**Section:** ${section!.section_number} - ${section!.title}\n\n`;
            response += `**Code:**\n\`\`\`verilog\n${firstCode.code}\n\`\`\`\n\n`;
            response += `**Context:**\n${section!.content}\n`;

            expect(response).toContain('# Code Example');
            expect(response).toContain('**Section:**');
            expect(response).toContain('```verilog');
            expect(response).toContain('**Context:**');
        });
    });

    describe('Table Retrieval', () => {
        test('should retrieve tables with section context end-to-end', async () => {
            // 1. Get tables
            const tables = await db.getTables('1', 'verilog');
            expect(tables.length).toBeGreaterThan(0);

            // 2. Get section context
            const section = await db.getSection('1', 'verilog', false);
            expect(section).toBeDefined();

            // 3. Format response
            let response = `# Tables from Section ${section!.section_number}\n\n`;
            response += `**Section Title:** ${section!.title}\n`;
            response += `**Tables:** ${tables.length}\n\n`;
            response += '---\n\n';

            for (let i = 0; i < tables.length; i++) {
                const table = tables[i];
                response += `## Table ${i + 1}\n\n`;
                if (table.caption) {
                    response += `**${table.caption}**\n\n`;
                }
                response += table.markdown + '\n\n';
            }

            expect(response).toContain('# Tables from Section');
            expect(response).toContain('**Section Title:**');
            expect(response).toContain('|');
        });
    });

    describe('Multi-Query Workflow', () => {
        test('should handle complex query sequence end-to-end', async () => {
            // Simulate a user workflow: search -> get section -> get code -> get tables

            // Step 1: Search
            const searchResults = await db.search('procedural', 'verilog', 5);
            expect(searchResults.length).toBeGreaterThan(0);

            // Step 2: Get the first result's section
            const sectionNumber = searchResults[0].section_number;
            const section = await db.getSection(sectionNumber, 'verilog', true);
            expect(section).toBeDefined();

            // Step 3: Get code examples from section
            const codes = await db.searchCode('always', 'verilog', 10);
            const sectionCodes = codes.filter((c) => c.section_number === sectionNumber);

            // Step 4: Get tables from section
            const tables = await db.getTables(sectionNumber, 'verilog');

            // Step 5: Get subsections
            const subsections = await db.getSubsections(sectionNumber, 'verilog');

            // Verify all data is coherent
            expect(section?.section_number).toBe(sectionNumber);
            if (subsections.length > 0) {
                subsections.forEach((sub) => {
                    expect(sub.number.startsWith(sectionNumber)).toBe(true);
                });
            }
        });
    });

    describe('Statistics and Metadata', () => {
        test('should retrieve and verify database statistics', async () => {
            const stats = await db.getStats();

            expect(stats.sections).toBeGreaterThan(0);
            expect(stats.code_examples).toBeGreaterThan(0);
            expect(stats.tables).toBeGreaterThan(0);

            // Verify counts match actual data
            const allSections = await db.listSections('verilog', null, 10);
            // stats.sections should be at least as many as top-level sections
            expect(stats.sections).toBeGreaterThanOrEqual(allSections.length);
        });

        test('should provide language-specific statistics', async () => {
            const verilogStats = await db.getStats('verilog');

            expect(verilogStats.sections).toBeGreaterThan(0);
            expect(verilogStats.code_examples).toBeGreaterThan(0);
        });
    });

    describe('Error Recovery', () => {
        test('should gracefully handle missing sections in workflow', async () => {
            // Try to get non-existent section
            const section = await db.getSection('999', 'verilog', false);
            expect(section).toBeNull();

            // Should be able to continue with other queries
            const stats = await db.getStats();
            expect(stats).toBeDefined();

            const search = await db.search('always', 'verilog', 5);
            expect(search).toBeDefined();
        });

        test('should handle empty result sets gracefully', async () => {
            // Query that returns no results
            const results = await db.search('nonexistentxyzabc', 'verilog', 5);
            expect(results).toEqual([]);

            // Should be able to continue
            const section = await db.getSection('1', 'verilog', false);
            expect(section).toBeDefined();
        });
    });

    describe('Data Consistency', () => {
        test('should maintain referential integrity throughout workflow', async () => {
            // Get all sections
            const sections = await db.listSections('verilog', null, 10);

            // For each section with subsections
            for (const section of sections.filter((s) => s.has_subsections)) {
                const subsections = await db.getSubsections(section.number, 'verilog');

                // All subsections should have this section as parent
                for (const sub of subsections) {
                    const subDetail = await db.getSection(sub.number, 'verilog', false);
                    expect(subDetail?.parent_section).toBe(section.number);
                }
            }
        });

        test('should maintain code examples linked to correct sections', async () => {
            // Get a section with code
            const section = await db.getSection('9.2.1', 'verilog', true);

            if ((section as any).code_examples?.length > 0) {
                // Search for code from this section
                const codes = await db.searchCode('always', 'verilog', 100);

                // Should find at least one code example from this section
                const sectionCodes = codes.filter((c) => c.section_number === section!.section_number);
                expect(sectionCodes.length).toBeGreaterThan(0);
            }
        });
    });
});
