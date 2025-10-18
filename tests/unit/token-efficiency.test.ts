/**
 * Token Efficiency Tests
 * Validates all token optimization features work correctly
 */

import { HDLDatabase } from '../../src/storage/database.js';
import { handleSearchLRM } from '../../src/handlers/search-handler.js';
import { handleGetSection, handleListSections } from '../../src/handlers/section-handler.js';
import { handleSearchCode } from '../../src/handlers/code-handler.js';
import { handleGetTable } from '../../src/handlers/table-handler.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';

describe('Token Efficiency Optimizations', () => {
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

    const measureSize = (obj: any): number => {
        return JSON.stringify(obj).length;
    };

    // ========================================================================
    // P0 #3: Optimized search_code (N+1 query elimination)
    // ========================================================================
    describe('P0 #3: search_code N+1 Query Elimination', () => {
        test('should include page numbers in results', async () => {
            const result = await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 5,
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.results.length).toBeGreaterThan(0);

            for (const item of data.results) {
                expect(item.page_start).toBeDefined();
                expect(item.page_end).toBeDefined();
                expect(typeof item.page_start).toBe('number');
                expect(typeof item.page_end).toBe('number');
                expect(item.page_start).toBeLessThanOrEqual(item.page_end);
            }
        });

        test('should fetch context only when requested', async () => {
            const withContext = await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 5,
                include_context: true,
            });

            const withoutContext = await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 5,
                include_context: false,
            });

            const withData = JSON.parse(withContext.content[0].text as string);
            const withoutData = JSON.parse(withoutContext.content[0].text as string);

            // With context should have context field
            expect(withData.results[0].context).toBeDefined();

            // Without context should not have context field
            expect(withoutData.results[0].context).toBeUndefined();

            // Without context should be smaller
            const withSize = measureSize(withContext.content[0].text);
            const withoutSize = measureSize(withoutContext.content[0].text);
            expect(withoutSize).toBeLessThan(withSize);
        });

        test('should be performant (< 200ms for 10 results)', async () => {
            const start = performance.now();
            await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 10,
                include_context: false,
            });
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(200);
        });
    });

    // ========================================================================
    // P1 #4: include_navigation parameter
    // ========================================================================
    describe('P1 #4: include_navigation Parameter', () => {
        test('should include navigation when requested', async () => {
            const result = await handleGetSection(db, {
                section_number: '9.2',
                language: 'verilog',
                include_navigation: true,
            });

            const data = JSON.parse(result.content[0].text as string);

            // Section 9.2 should have subsections
            expect(data.section.subsections).toBeDefined();
            expect(data.section.subsections.length).toBeGreaterThan(0);
        });

        test('should omit navigation when not requested', async () => {
            const result = await handleGetSection(db, {
                section_number: '9.2',
                language: 'verilog',
                include_navigation: false,
            });

            const data = JSON.parse(result.content[0].text as string);

            // Navigation fields should be empty or minimal
            expect(data.section.subsections).toBeUndefined();
            expect(data.section.sibling_sections).toBeUndefined();
        });

        test('should save tokens when navigation omitted', async () => {
            const withNav = await handleGetSection(db, {
                section_number: '9.2',
                language: 'verilog',
                include_navigation: true,
            });

            const withoutNav = await handleGetSection(db, {
                section_number: '9.2',
                language: 'verilog',
                include_navigation: false,
            });

            const withSize = measureSize(withNav.content[0].text);
            const withoutSize = measureSize(withoutNav.content[0].text);

            expect(withoutSize).toBeLessThan(withSize);
            const savings = ((withSize - withoutSize) / withSize * 100);
            expect(savings).toBeGreaterThan(10); // At least 10% savings
        });

        test('should default to false (token-efficient)', async () => {
            // Call without include_navigation parameter
            const result = await handleGetSection(db, {
                section_number: '9.2',
                language: 'verilog',
            });

            const data = JSON.parse(result.content[0].text as string);

            // Default should be no navigation
            expect(data.section.subsections).toBeUndefined();
        });
    });

    // ========================================================================
    // P1 #5: list_sections detail_level parameter
    // ========================================================================
    describe('P1 #5: list_sections detail_level Parameter', () => {
        test('should return minimal fields in minimal mode', async () => {
            const result = await handleListSections(db, {
                language: 'verilog',
                detail_level: 'minimal',
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.sections.length).toBeGreaterThan(0);

            // Minimal should have only section_number and title
            const firstSection = data.sections[0];
            expect(firstSection.section_number).toBeDefined();
            expect(firstSection.title).toBeDefined();
            expect(firstSection.depth).toBeUndefined();
            expect(firstSection.has_subsections).toBeUndefined();
        });

        test('should return all fields in full mode', async () => {
            const result = await handleListSections(db, {
                language: 'verilog',
                detail_level: 'full',
            });

            const data = JSON.parse(result.content[0].text as string);
            const firstSection = data.sections[0];

            // Full should have all fields
            expect(firstSection.section_number).toBeDefined();
            expect(firstSection.title).toBeDefined();
            expect(firstSection.depth).toBeDefined();
            expect(firstSection.has_subsections).toBeDefined();
        });

        test('should save tokens in minimal mode', async () => {
            const minimal = await handleListSections(db, {
                language: 'verilog',
                max_depth: 2,
                detail_level: 'minimal',
            });

            const full = await handleListSections(db, {
                language: 'verilog',
                max_depth: 2,
                detail_level: 'full',
            });

            const minimalSize = measureSize(minimal.content[0].text);
            const fullSize = measureSize(full.content[0].text);

            expect(minimalSize).toBeLessThan(fullSize);
            const savings = ((fullSize - minimalSize) / fullSize * 100);
            expect(savings).toBeGreaterThan(15); // At least 15% savings
        });

        test('should default to full (backward compatible)', async () => {
            const result = await handleListSections(db, {
                language: 'verilog',
            });

            const data = JSON.parse(result.content[0].text as string);
            const firstSection = data.sections[0];

            // Default should be full mode
            expect(firstSection.depth).toBeDefined();
            expect(firstSection.has_subsections).toBeDefined();
        });
    });

    // ========================================================================
    // P2 #6: include_metadata parameter
    // ========================================================================
    describe('P2 #6: include_metadata Parameter', () => {
        test('search_lrm: should include metadata when requested', async () => {
            const result = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 5,
                detail_level: 'full',
                include_metadata: true,
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.metadata).toBeDefined();
            expect(data.metadata.tool).toBe('search_lrm');
        });

        test('search_lrm: should omit metadata when not requested', async () => {
            const result = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 5,
                detail_level: 'full',
                include_metadata: false,
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.metadata).toBeUndefined();
        });

        test('get_section: should save tokens without metadata', async () => {
            const withMeta = await handleGetSection(db, {
                section_number: '9.2.1',
                language: 'verilog',
                include_metadata: true,
            });

            const withoutMeta = await handleGetSection(db, {
                section_number: '9.2.1',
                language: 'verilog',
                include_metadata: false,
            });

            const withSize = measureSize(withMeta.content[0].text);
            const withoutSize = measureSize(withoutMeta.content[0].text);

            expect(withoutSize).toBeLessThan(withSize);
            const savings = withSize - withoutSize;
            expect(savings).toBeGreaterThan(50); // At least 50 bytes saved
        });

        test('all tools: should default to true (backward compatible)', async () => {
            // Test each tool without include_metadata parameter
            const search = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 5,
                detail_level: 'full',
            });

            const section = await handleGetSection(db, {
                section_number: '9.2.1',
                language: 'verilog',
            });

            const list = await handleListSections(db, {
                language: 'verilog',
            });

            const code = await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 5,
            });

            const searchData = JSON.parse(search.content[0].text as string);
            const sectionData = JSON.parse(section.content[0].text as string);
            const listData = JSON.parse(list.content[0].text as string);
            const codeData = JSON.parse(code.content[0].text as string);

            // Default should include metadata
            expect(searchData.metadata).toBeDefined();
            expect(sectionData.metadata).toBeDefined();
            expect(listData.metadata).toBeDefined();
            expect(codeData.metadata).toBeDefined();
        });
    });

    // ========================================================================
    // P2 #7: verbose_errors parameter
    // ========================================================================
    describe('P2 #7: verbose_errors Parameter', () => {
        test('should include suggestions in verbose mode', async () => {
            const result = await handleSearchLRM(db, {
                query: 'nonexistentquerythatreturnsnothing12345',
                language: 'verilog',
                max_results: 5,
                verbose_errors: true,
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.suggestions).toBeDefined();
            expect(data.suggestions.length).toBeGreaterThan(0);
        });

        test('should omit suggestions in minimal error mode', async () => {
            const result = await handleSearchLRM(db, {
                query: 'nonexistentquerythatreturnsnothing12345',
                language: 'verilog',
                max_results: 5,
                verbose_errors: false,
            });

            const data = JSON.parse(result.content[0].text as string);
            expect(data.error).toBeDefined();
            expect(data.message).toBeDefined();
            expect(data.suggestions).toBeUndefined();
        });

        test('should save tokens in minimal error mode', async () => {
            const verbose = await handleSearchLRM(db, {
                query: 'nonexistentquerythatreturnsnothing12345',
                language: 'verilog',
                max_results: 5,
                verbose_errors: true,
            });

            const minimal = await handleSearchLRM(db, {
                query: 'nonexistentquerythatreturnsnothing12345',
                language: 'verilog',
                max_results: 5,
                verbose_errors: false,
            });

            const verboseSize = measureSize(verbose.content[0].text);
            const minimalSize = measureSize(minimal.content[0].text);

            expect(minimalSize).toBeLessThan(verboseSize);
            const savings = verboseSize - minimalSize;
            expect(savings).toBeGreaterThan(100); // At least 100 bytes saved
        });

        test('should default to true (backward compatible)', async () => {
            const result = await handleSearchLRM(db, {
                query: 'nonexistentquerythatreturnsnothing12345',
                language: 'verilog',
                max_results: 5,
            });

            const data = JSON.parse(result.content[0].text as string);

            // Default should be verbose
            expect(data.suggestions).toBeDefined();
        });
    });

    // ========================================================================
    // Integration Tests: Data Integrity
    // ========================================================================
    describe('Data Integrity Across Optimizations', () => {
        test('detail_level should not change content, only include/exclude it', async () => {
            const minimal = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 5,
                detail_level: 'minimal',
            });

            const full = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 5,
                detail_level: 'full',
            });

            const minimalData = JSON.parse(minimal.content[0].text as string);
            const fullData = JSON.parse(full.content[0].text as string);

            // Same sections should be returned
            expect(minimalData.results.length).toBe(fullData.results.length);

            // Section numbers and titles should match
            for (let i = 0; i < minimalData.results.length; i++) {
                expect(minimalData.results[i].section_number).toBe(fullData.results[i].section_number);
                expect(minimalData.results[i].title).toBe(fullData.results[i].title);
                expect(minimalData.results[i].page).toBe(fullData.results[i].page);
            }
        });

        test('navigation data should be consistent when present', async () => {
            const result = await handleGetSection(db, {
                section_number: '9.2',
                language: 'verilog',
                include_navigation: true,
            });

            const data = JSON.parse(result.content[0].text as string);

            // Verify subsection numbering is correct
            if (data.section.subsections) {
                for (const sub of data.section.subsections) {
                    expect(sub.section_number.startsWith('9.2.')).toBe(true);
                }
            }

            // Verify parent relationship
            if (data.section.parent_section) {
                expect(data.section.section_number.startsWith(data.section.parent_section.section_number + '.')).toBe(true);
            }
        });

        test('page numbers in search_code should be accurate', async () => {
            const result = await handleSearchCode(db, {
                query: 'always',
                language: 'verilog',
                max_results: 10,
            });

            const data = JSON.parse(result.content[0].text as string);

            for (const item of data.results) {
                // Page numbers should be positive integers
                expect(item.page_start).toBeGreaterThan(0);
                expect(item.page_end).toBeGreaterThan(0);

                // Page range should be valid
                expect(item.page_start).toBeLessThanOrEqual(item.page_end);

                // Page numbers should be reasonable (Verilog LRM is ~600 pages)
                expect(item.page_start).toBeLessThan(1000);
                expect(item.page_end).toBeLessThan(1000);
            }
        });
    });

    // ========================================================================
    // Integration Tests: Workflow Scenarios
    // ========================================================================
    describe('Complete Workflow Scenarios', () => {
        test('discovery → retrieval workflow should be efficient', async () => {
            // Step 1: Discovery with minimal
            const discovery = await handleSearchLRM(db, {
                query: 'blocking assignments',
                language: 'verilog',
                max_results: 10,
                detail_level: 'minimal',
                include_metadata: false,
            });

            const discoverySize = measureSize(discovery.content[0].text);

            // Step 2: Retrieve top 2 sections
            const discoveryData = JSON.parse(discovery.content[0].text as string);
            const sections = await Promise.all([
                handleGetSection(db, {
                    section_number: discoveryData.results[0].section_number,
                    language: 'verilog',
                    include_code: true,
                    include_navigation: false,
                    include_metadata: false,
                }),
                handleGetSection(db, {
                    section_number: discoveryData.results[1].section_number,
                    language: 'verilog',
                    include_code: true,
                    include_navigation: false,
                    include_metadata: false,
                }),
            ]);

            const section1Size = measureSize(sections[0].content[0].text);
            const section2Size = measureSize(sections[1].content[0].text);
            const totalSize = discoverySize + section1Size + section2Size;

            // Total should be under 10KB for efficient workflow
            expect(totalSize).toBeLessThan(10000);
        });

        test('browse → navigate → retrieve workflow', async () => {
            // Step 1: Browse TOC
            const toc = await handleListSections(db, {
                language: 'verilog',
                max_depth: 1,
                detail_level: 'minimal',
                include_metadata: false,
            });

            // Step 2: Navigate to specific section
            const tocData = JSON.parse(toc.content[0].text as string);
            const section = await handleGetSection(db, {
                section_number: tocData.sections[0].section_number,
                language: 'verilog',
                include_navigation: true,
                include_code: false,
                include_metadata: false,
            });

            // Step 3: Get code examples
            const sectionData = JSON.parse(section.content[0].text as string);
            if (sectionData.section.subsections && sectionData.section.subsections.length > 0) {
                const codeSection = await handleGetSection(db, {
                    section_number: sectionData.section.subsections[0].section_number,
                    language: 'verilog',
                    include_code: true,
                    include_navigation: false,
                    include_metadata: false,
                });

                expect(codeSection).toBeDefined();
            }
        });
    });

    // ========================================================================
    // Backward Compatibility Tests
    // ========================================================================
    describe('Backward Compatibility', () => {
        test('all tools should work without new parameters', async () => {
            // Old-style calls without new parameters
            await expect(
                handleSearchLRM(db, {
                    query: 'blocking assignments',
                    language: 'verilog',
                    max_results: 5,
                })
            ).resolves.toBeDefined();

            await expect(
                handleGetSection(db, {
                    section_number: '9.2.1',
                    language: 'verilog',
                })
            ).resolves.toBeDefined();

            await expect(
                handleListSections(db, {
                    language: 'verilog',
                })
            ).resolves.toBeDefined();

            await expect(
                handleSearchCode(db, {
                    query: 'always',
                    language: 'verilog',
                    max_results: 10,
                })
            ).resolves.toBeDefined();

            await expect(
                handleGetTable(db, {
                    section_number: '1',
                    language: 'verilog',
                })
            ).resolves.toBeDefined();
        });
    });
});
