#!/usr/bin/env node
/**
 * Athens HDL MCP - Database Initialization Script
 *
 * Creates a fresh SQLite database with the schema defined in schema.sql
 * Usage: npm run init-db
 */

import sqlite3 from 'sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../data/hdl-lrm.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

async function initializeDatabase(): Promise<void> {
    console.log('🏗️  Athens HDL MCP Database Initialization\n');

    // Check if database already exists
    if (existsSync(DB_PATH)) {
        console.log(`⚠️  Database already exists at: ${DB_PATH}`);
        console.log('   Delete it first if you want to reinitialize.\n');
        process.exit(1);
    }

    // Read schema file
    console.log(`📖 Reading schema from: ${SCHEMA_PATH}`);
    let schema: string;
    try {
        schema = readFileSync(SCHEMA_PATH, 'utf-8');
    } catch (error) {
        console.error(`❌ Failed to read schema file: ${error}`);
        process.exit(1);
    }

    // Create database
    console.log(`📦 Creating database at: ${DB_PATH}`);
    const db = new sqlite3.Database(DB_PATH);

    // Execute schema
    return new Promise((resolve, reject) => {
        db.exec(schema, (error) => {
            if (error) {
                console.error(`❌ Failed to execute schema: ${error}`);
                db.close();
                reject(error);
                return;
            }

            console.log('✅ Schema executed successfully\n');

            // Verify tables were created
            db.all(
                "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'trigger', 'index') ORDER BY type, name",
                [],
                (error, rows) => {
                    if (error) {
                        console.error(`❌ Failed to verify schema: ${error}`);
                        db.close();
                        reject(error);
                        return;
                    }

                    console.log('📋 Created Objects:\n');

                    const tables = rows.filter((r: any) => r.type === 'table');
                    const triggers = rows.filter((r: any) => r.type === 'trigger');
                    const indexes = rows.filter((r: any) => r.type === 'index');

                    console.log(`   Tables (${tables.length}):`);
                    tables.forEach((r: any) => console.log(`     - ${r.name}`));

                    console.log(`\n   Triggers (${triggers.length}):`);
                    triggers.forEach((r: any) => console.log(`     - ${r.name}`));

                    console.log(`\n   Indexes (${indexes.length}):`);
                    indexes.forEach((r: any) => console.log(`     - ${r.name}`));

                    console.log('\n✅ Database initialized successfully!');
                    console.log(`   Location: ${DB_PATH}\n`);

                    db.close((closeError) => {
                        if (closeError) {
                            console.error(`⚠️  Error closing database: ${closeError}`);
                        }
                        resolve();
                    });
                }
            );
        });
    });
}

// Run initialization
initializeDatabase().catch((error) => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
});