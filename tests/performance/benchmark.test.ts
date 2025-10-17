/**
 * Performance benchmark tests
 * Ensures system meets performance requirements
 */

import { HDLDatabase } from '../../src/storage/database.js';
import { setupTestDatabase, cleanupTestDatabase, TEST_DB_PATH } from '../setup.js';

describe('Performance Benchmarks', () => {
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

    describe('Query Performance', () => {
        test('search should complete in < 100ms', async () => {
            const start = performance.now();
            await db.search('always', 'verilog', 5);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100);
            console.log(`  ⏱️  Search took ${duration.toFixed(2)}ms`);
        });

        test('getSection should complete in < 50ms', async () => {
            const start = performance.now();
            await db.getSection('1', 'verilog', false);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(50);
            console.log(`  ⏱️  Get section took ${duration.toFixed(2)}ms`);
        });

        test('listSections should complete in < 100ms', async () => {
            const start = performance.now();
            await db.listSections('verilog', null, 2);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100);
            console.log(`  ⏱️  List sections took ${duration.toFixed(2)}ms`);
        });

        test('searchCode should complete in < 100ms', async () => {
            const start = performance.now();
            await db.searchCode('always', 'verilog', 10);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100);
            console.log(`  ⏱️  Search code took ${duration.toFixed(2)}ms`);
        });

        test('getTables should complete in < 50ms', async () => {
            const start = performance.now();
            await db.getTables('1', 'verilog');
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(50);
            console.log(`  ⏱️  Get tables took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Batch Query Performance', () => {
        test('should handle 10 sequential searches efficiently', async () => {
            const queries = ['always', 'module', 'wire', 'reg', 'assign', 'begin', 'end', 'posedge', 'negedge', 'clock'];

            const start = performance.now();
            for (const query of queries) {
                await db.search(query, 'verilog', 5);
            }
            const duration = performance.now() - start;

            const avgTime = duration / queries.length;
            expect(avgTime).toBeLessThan(100);
            console.log(`  ⏱️  Average search time: ${avgTime.toFixed(2)}ms`);
            console.log(`  ⏱️  Total time for 10 searches: ${duration.toFixed(2)}ms`);
        });

        test('should handle 10 section retrievals efficiently', async () => {
            const sections = ['1', '1.1', '9', '9.2', '9.2.1'];

            const start = performance.now();
            for (const section of sections) {
                await db.getSection(section, 'verilog', true);
            }
            const duration = performance.now() - start;

            const avgTime = duration / sections.length;
            expect(avgTime).toBeLessThan(100);
            console.log(`  ⏱️  Average section retrieval time: ${avgTime.toFixed(2)}ms`);
        });
    });

    describe('Concurrent Query Performance', () => {
        test('should handle 10 concurrent searches efficiently', async () => {
            const queries = ['always', 'module', 'wire', 'reg', 'assign', 'begin', 'end', 'posedge', 'negedge', 'clock'];

            const start = performance.now();
            await Promise.all(queries.map((query) => db.search(query, 'verilog', 5)));
            const duration = performance.now() - start;

            // Concurrent should be faster than sequential
            expect(duration).toBeLessThan(500); // Generous limit for concurrent
            console.log(`  ⏱️  10 concurrent searches took ${duration.toFixed(2)}ms`);
        });

        test('should maintain performance under concurrent load', async () => {
            const operations = [
                db.search('always', 'verilog', 5),
                db.getSection('1', 'verilog', false),
                db.listSections('verilog', null, 2),
                db.searchCode('module', 'verilog', 10),
                db.getTables('1', 'verilog'),
            ];

            const start = performance.now();
            await Promise.all(operations);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(300);
            console.log(`  ⏱️  5 concurrent different operations took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Full-Text Search Performance', () => {
        test('should handle complex FTS queries efficiently', async () => {
            const complexQueries = [
                'always AND block',
                'procedural modeling',
                'sensitivity list',
                'posedge OR negedge',
                'combinational logic',
            ];

            let totalDuration = 0;
            for (const query of complexQueries) {
                const start = performance.now();
                await db.search(query, 'verilog', 5);
                const duration = performance.now() - start;
                totalDuration += duration;
            }

            const avgTime = totalDuration / complexQueries.length;
            expect(avgTime).toBeLessThan(100);
            console.log(`  ⏱️  Average complex FTS query time: ${avgTime.toFixed(2)}ms`);
        });

        test('should handle large result sets efficiently', async () => {
            const start = performance.now();
            const results = await db.search('verilog', 'verilog', 20);
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(150);
            expect(results.length).toBeGreaterThan(0);
            console.log(`  ⏱️  Large result set (${results.length} results) took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Code Search Performance', () => {
        test('should efficiently search through code examples', async () => {
            const codeQueries = ['always', 'posedge', 'assign', 'module', 'begin'];

            let totalDuration = 0;
            for (const query of codeQueries) {
                const start = performance.now();
                await db.searchCode(query, 'verilog', 10);
                const duration = performance.now() - start;
                totalDuration += duration;
            }

            const avgTime = totalDuration / codeQueries.length;
            expect(avgTime).toBeLessThan(100);
            console.log(`  ⏱️  Average code search time: ${avgTime.toFixed(2)}ms`);
        });
    });

    describe('Hierarchical Navigation Performance', () => {
        test('should efficiently navigate section hierarchy', async () => {
            const start = performance.now();

            // Get top-level
            const topLevel = await db.listSections('verilog', null, 0);

            // Get first section's subsections
            if (topLevel.length > 0) {
                await db.getSubsections(topLevel[0].number, 'verilog');
            }

            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100);
            console.log(`  ⏱️  Hierarchy navigation took ${duration.toFixed(2)}ms`);
        });

        test('should efficiently retrieve deep hierarchies', async () => {
            const start = performance.now();

            // Get multiple depth levels
            await db.listSections('verilog', null, 3);

            const duration = performance.now() - start;

            expect(duration).toBeLessThan(150);
            console.log(`  ⏱️  Deep hierarchy retrieval took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Database Connection Performance', () => {
        test('should connect to database quickly', async () => {
            const testDb = new HDLDatabase(TEST_DB_PATH);

            const start = performance.now();
            await testDb.connect();
            const duration = performance.now() - start;

            await testDb.close();

            expect(duration).toBeLessThan(50);
            console.log(`  ⏱️  Database connection took ${duration.toFixed(2)}ms`);
        });

        test('should close database quickly', async () => {
            const testDb = new HDLDatabase(TEST_DB_PATH);
            await testDb.connect();

            const start = performance.now();
            await testDb.close();
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(50);
            console.log(`  ⏱️  Database close took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Statistics Query Performance', () => {
        test('should retrieve statistics quickly', async () => {
            const start = performance.now();
            await db.getStats();
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100);
            console.log(`  ⏱️  Stats retrieval took ${duration.toFixed(2)}ms`);
        });

        test('should retrieve language-specific statistics quickly', async () => {
            const start = performance.now();
            await db.getStats('verilog');
            const duration = performance.now() - start;

            expect(duration).toBeLessThan(100);
            console.log(`  ⏱️  Language-specific stats took ${duration.toFixed(2)}ms`);
        });
    });

    describe('Memory Usage', () => {
        test('should not leak memory during repeated queries', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // Perform many queries
            for (let i = 0; i < 100; i++) {
                await db.search('always', 'verilog', 5);
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

            // Memory increase should be minimal (< 10MB)
            expect(memoryIncrease).toBeLessThan(10);
            console.log(`  💾  Memory increase after 100 queries: ${memoryIncrease.toFixed(2)}MB`);
        });
    });

    describe('Stress Test', () => {
        test('should handle 100 mixed operations efficiently', async () => {
            const operations = [];

            // Mix of different operations
            for (let i = 0; i < 100; i++) {
                const op = i % 5;
                switch (op) {
                    case 0:
                        operations.push(db.search('always', 'verilog', 5));
                        break;
                    case 1:
                        operations.push(db.getSection('1', 'verilog', false));
                        break;
                    case 2:
                        operations.push(db.listSections('verilog', null, 2));
                        break;
                    case 3:
                        operations.push(db.searchCode('module', 'verilog', 10));
                        break;
                    case 4:
                        operations.push(db.getTables('1', 'verilog'));
                        break;
                }
            }

            const start = performance.now();
            await Promise.all(operations);
            const duration = performance.now() - start;

            const avgTime = duration / operations.length;
            expect(avgTime).toBeLessThan(50); // Average per operation
            console.log(`  ⏱️  100 mixed operations took ${duration.toFixed(2)}ms`);
            console.log(`  ⏱️  Average time per operation: ${avgTime.toFixed(2)}ms`);
        }, 30000); // 30 second timeout for stress test
    });
});
