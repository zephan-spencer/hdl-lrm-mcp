#!/usr/bin/env node

/**
 * Test script to measure embedding server performance
 * Compares first query (with model loading) vs subsequent queries
 */

import { HDLDatabase } from './dist/storage/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPerformance() {
    const dbPath = join(__dirname, 'data', 'hdl-lrm.db');
    const db = new HDLDatabase(dbPath);

    console.log('='.repeat(80));
    console.log('EMBEDDING SERVER PERFORMANCE TEST');
    console.log('='.repeat(80));
    console.log();

    try {
        // Connect (starts the embedding server)
        console.log('Connecting to database and starting embedding server...');
        const connectStart = Date.now();
        await db.connect();
        const connectTime = Date.now() - connectStart;
        console.log(`✓ Connected in ${connectTime}ms`);
        console.log();

        // Test queries
        const queries = [
            'always block sensitivity list combinational logic',
            'clock edge detection sequential circuits',
            'module instantiation parameter passing'
        ];

        console.log('Running semantic search queries...');
        console.log('-'.repeat(80));

        const times = [];

        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            console.log();
            console.log(`Query ${i + 1}: "${query}"`);

            const start = Date.now();
            const results = await db.semanticSearchByText(query, 'systemverilog', 3);
            const elapsed = Date.now() - start;
            times.push(elapsed);

            console.log(`  Time: ${elapsed}ms`);
            console.log(`  Results: ${results.length} sections found`);

            if (results.length > 0) {
                console.log(`  Top result: ${results[0].section_number} - ${results[0].title}`);
            }
        }

        console.log();
        console.log('='.repeat(80));
        console.log('PERFORMANCE SUMMARY');
        console.log('='.repeat(80));
        console.log(`First query (with model already loaded):  ${times[0]}ms`);
        console.log(`Second query:                             ${times[1]}ms`);
        console.log(`Third query:                              ${times[2]}ms`);
        console.log();

        const avgSubsequent = (times[1] + times[2]) / 2;
        const speedup = times[0] / avgSubsequent;

        console.log(`Average for queries 2-3: ${avgSubsequent.toFixed(1)}ms`);

        if (times[0] > times[1]) {
            console.log(`Speedup factor: ${speedup.toFixed(1)}x faster after first query`);
        }
        console.log();
        console.log('✓ All queries completed successfully!');

        // Close
        await db.close();
        console.log('✓ Database closed, server stopped');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testPerformance();
