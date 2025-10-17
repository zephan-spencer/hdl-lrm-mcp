/**
 * Unit tests for HDL Database Layer
 */

import { HDLDatabase } from '../../src/storage/database.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';
import { testSections, edgeCaseData } from '../fixtures/test-data.js';

describe('HDLDatabase', () => {
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

    describe('Connection', () => {
        test('should connect to database successfully', async () => {
            const testDb = new HDLDatabase(TEST_DB_PATH);
            await expect(testDb.connect()).resolves.not.toThrow();
            await testDb.close();
        });

        test('should throw error when connecting to non-existent database', async () => {
            const testDb = new HDLDatabase('/non/existent/path/db.db');
            await expect(testDb.connect()).rejects.toThrow();
        });

        test('should close database connection', async () => {
            await expect(db.close()).resolves.not.toThrow();
            // Create new connection for afterEach cleanup
            db = new HDLDatabase(TEST_DB_PATH);
            await db.connect();
        });
    });

    describe('search()', () => {
        test('should find sections matching query', async () => {
            const results = await db.search('always', 'verilog', 5);
            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('section_number');
            expect(results[0]).toHaveProperty('title');
            expect(results[0]).toHaveProperty('snippet');
            expect(results[0]).toHaveProperty('page_start');
        });

        test('should return empty array for non-matching query', async () => {
            const results = await db.search('nonexistentxyzabc', 'verilog', 5);
            expect(results).toEqual([]);
        });

        test('should respect max_results limit', async () => {
            const results = await db.search('verilog', 'verilog', 2);
            expect(results.length).toBeLessThanOrEqual(2);
        });

        test('should handle special characters in query', async () => {
            const results = await db.search('@(posedge', 'verilog', 5);
            expect(results).toBeDefined();
        });

        test('should return results ordered by relevance', async () => {
            const results = await db.search('always', 'verilog', 5);
            if (results.length > 1) {
                // BM25 relevance scores should be ordered (higher is better, but values are negative)
                expect(results[0].relevance).toBeLessThanOrEqual(results[1].relevance);
            }
        });
    });

    describe('getSection()', () => {
        test('should retrieve section by number and language', async () => {
            const section = await db.getSection('1', 'verilog', false);
            expect(section).toBeDefined();
            expect(section?.section_number).toBe('1');
            expect(section?.language).toBe('verilog');
            expect(section?.title).toBe('Overview');
            expect(section?.content).toContain('overview');
        });

        test('should return null for non-existent section', async () => {
            const section = await db.getSection('999', 'verilog', false);
            expect(section).toBeNull();
        });

        test('should include code examples when requested', async () => {
            const section = await db.getSection('9.2.1', 'verilog', true);
            expect(section).toBeDefined();
            expect((section as any).code_examples).toBeDefined();
            expect((section as any).code_examples.length).toBeGreaterThan(0);
        });

        test('should not include code examples when not requested', async () => {
            const section = await db.getSection('9.2.1', 'verilog', false);
            expect(section).toBeDefined();
            expect((section as any).code_examples).toBeUndefined();
        });

        test('should handle hierarchical sections', async () => {
            const parent = await db.getSection('9', 'verilog', false);
            const child = await db.getSection('9.2', 'verilog', false);
            const grandchild = await db.getSection('9.2.1', 'verilog', false);

            expect(parent).toBeDefined();
            expect(child).toBeDefined();
            expect(grandchild).toBeDefined();
            expect(parent?.depth).toBe(0);
            expect(child?.depth).toBe(1);
            expect(grandchild?.depth).toBe(2);
        });
    });

    describe('getSubsections()', () => {
        test('should retrieve subsections of a parent section', async () => {
            const subsections = await db.getSubsections('9', 'verilog');
            expect(subsections).toBeDefined();
            expect(subsections.length).toBeGreaterThan(0);
            expect(subsections[0].number).toBe('9.2');
        });

        test('should return empty array for section with no subsections', async () => {
            const subsections = await db.getSubsections('9.2.1', 'verilog');
            expect(subsections).toEqual([]);
        });

        test('should indicate when subsections have their own children', async () => {
            const subsections = await db.getSubsections('9', 'verilog');
            const section92 = subsections.find((s) => s.number === '9.2');
            expect(section92?.has_subsections).toBe(true);
        });
    });

    describe('listSections()', () => {
        test('should list top-level sections', async () => {
            const sections = await db.listSections('verilog', null, 2);
            expect(sections).toBeDefined();
            expect(sections.length).toBeGreaterThan(0);
            const topLevel = sections.filter((s) => s.depth === 0);
            expect(topLevel.length).toBeGreaterThan(0);
        });

        test('should respect max_depth parameter', async () => {
            const sections = await db.listSections('verilog', null, 1);
            const tooDeep = sections.find((s) => s.depth > 1);
            expect(tooDeep).toBeUndefined();
        });

        test('should list children of specific parent', async () => {
            const sections = await db.listSections('verilog', '9', 2);
            expect(sections).toBeDefined();
            expect(sections.length).toBeGreaterThan(0);
            // All should be children of section 9
            sections.forEach((s) => {
                expect(s.number.startsWith('9.')).toBe(true);
            });
        });

        test('should return empty array for non-existent language', async () => {
            const sections = await db.listSections('nonexistent' as any, null, 2);
            expect(sections).toEqual([]);
        });
    });

    describe('searchCode()', () => {
        test('should find code examples matching query', async () => {
            const results = await db.searchCode('always', 'verilog', 10);
            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);
            expect(results[0]).toHaveProperty('code');
            expect(results[0]).toHaveProperty('section_number');
        });

        test('should return empty array for non-matching query', async () => {
            const results = await db.searchCode('nonexistentxyzabc', 'verilog', 10);
            expect(results).toEqual([]);
        });

        test('should search in code content', async () => {
            const results = await db.searchCode('posedge', 'verilog', 10);
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].code).toContain('posedge');
        });

        test('should search in description', async () => {
            const results = await db.searchCode('flip-flop', 'verilog', 10);
            expect(results.length).toBeGreaterThan(0);
        });

        test('should respect max_results limit', async () => {
            const results = await db.searchCode('always', 'verilog', 1);
            expect(results.length).toBeLessThanOrEqual(1);
        });
    });

    describe('getTables()', () => {
        test('should retrieve tables from a section', async () => {
            const tables = await db.getTables('1', 'verilog');
            expect(tables).toBeDefined();
            expect(tables.length).toBeGreaterThan(0);
            expect(tables[0]).toHaveProperty('caption');
            expect(tables[0]).toHaveProperty('markdown');
        });

        test('should return empty array for section with no tables', async () => {
            const tables = await db.getTables('9.2.1', 'verilog');
            expect(tables).toEqual([]);
        });

        test('should return tables with markdown format', async () => {
            const tables = await db.getTables('1', 'verilog');
            expect(tables[0].markdown).toContain('|');
            expect(tables[0].markdown).toContain('Type');
        });
    });

    describe('getStats()', () => {
        test('should return statistics for all languages', async () => {
            const stats = await db.getStats();
            expect(stats).toBeDefined();
            expect(stats.sections).toBeGreaterThan(0);
            expect(stats.code_examples).toBeGreaterThan(0);
            expect(stats.tables).toBeGreaterThan(0);
        });

        test('should return statistics for specific language', async () => {
            const stats = await db.getStats('verilog');
            expect(stats).toBeDefined();
            expect(stats.sections).toBeGreaterThan(0);
        });

        test('should return zero for non-existent language', async () => {
            const stats = await db.getStats('nonexistent');
            expect(stats.sections).toBe(0);
            expect(stats.code_examples).toBe(0);
            expect(stats.tables).toBe(0);
        });
    });

    describe('Error Handling', () => {
        test('should throw error when querying before connection', async () => {
            const testDb = new HDLDatabase(TEST_DB_PATH);
            await expect(testDb.search('test', 'verilog', 5)).rejects.toThrow('not connected');
        });

        test('should handle database errors gracefully', async () => {
            // Close the database to cause errors
            await db.close();
            await expect(db.search('test', 'verilog', 5)).rejects.toThrow();

            // Reconnect for afterEach cleanup
            db = new HDLDatabase(TEST_DB_PATH);
            await db.connect();
        });
    });
});
