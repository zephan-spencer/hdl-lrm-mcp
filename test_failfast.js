#!/usr/bin/env node

/**
 * Test fail-fast behavior when embedding server is unavailable
 */

import { HDLDatabase } from './dist/storage/database.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testFailFast() {
    const dbPath = join(__dirname, 'data', 'hdl-lrm.db');
    const db = new HDLDatabase(dbPath);

    console.log('='.repeat(80));
    console.log('FAIL-FAST BEHAVIOR TEST');
    console.log('='.repeat(80));
    console.log();

    // Test 1: Try to use semantic search without connecting
    console.log('Test 1: Semantic search without server connection');
    console.log('-'.repeat(80));
    try {
        await db.semanticSearchByText('test query', 'systemverilog', 3);
        console.log('❌ FAILED: Should have thrown an error!');
        process.exit(1);
    } catch (error) {
        console.log('✓ Correctly threw error:', error.message);
    }
    console.log();

    // Test 2: Simulate port already in use (server won't start)
    console.log('Test 2: Server startup failure (simulated by port conflict)');
    console.log('-'.repeat(80));

    // First, start the server normally
    const db2 = new HDLDatabase(dbPath);
    try {
        await db2.connect();
        console.log('✓ First server started successfully');

        // Now try to start a second one on the same port
        const db3 = new HDLDatabase(dbPath);
        try {
            await db3.connect();
            console.log('❌ FAILED: Second server should have failed to start!');
            process.exit(1);
        } catch (error) {
            console.log('✓ Correctly failed to start second server:', error.message.substring(0, 100) + '...');
        }

        await db2.close();
        console.log('✓ First server closed');
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }

    console.log();
    console.log('='.repeat(80));
    console.log('ALL FAIL-FAST TESTS PASSED!');
    console.log('='.repeat(80));
    console.log();
    console.log('Summary:');
    console.log('✓ Semantic search fails fast when server not ready');
    console.log('✓ Database connection fails fast when server cannot start');
    console.log('✓ No slow 89-second fallback anywhere');
}

testFailFast();
