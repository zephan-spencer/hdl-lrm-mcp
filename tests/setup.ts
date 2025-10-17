/**
 * Test setup utilities for Athens HDL MCP tests
 */

import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { testSections, testCodeExamples, testTables } from './fixtures/test-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const TEST_DB_PATH = join(__dirname, '../data/test-hdl-lrm.db');
export const SCHEMA_PATH = join(__dirname, '../src/storage/schema.sql');

/**
 * Initialize a test database with schema
 */
export async function initTestDatabase(): Promise<void> {
    // Remove existing test database
    try {
        await fs.unlink(TEST_DB_PATH);
    } catch (error) {
        // File doesn't exist, that's fine
    }

    // Ensure data directory exists
    const dataDir = dirname(TEST_DB_PATH);
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
        // Directory exists, that's fine
    }

    // Read schema
    const schema = await fs.readFile(SCHEMA_PATH, 'utf-8');

    // Create database and apply schema
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }

            db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                db.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    });
}

/**
 * Populate test database with sample data
 */
export async function populateTestDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(TEST_DB_PATH);

        db.serialize(() => {
            const sectionIds: { [key: string]: number } = {};

            // Insert sections
            const insertSection = db.prepare(`
                INSERT INTO sections (language, section_number, parent_section, title, content, page_start, page_end, depth)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const section of testSections) {
                insertSection.run(
                    section.language,
                    section.section_number,
                    section.parent_section,
                    section.title,
                    section.content,
                    section.page_start,
                    section.page_end,
                    section.depth,
                    function (err) {
                        if (!err) {
                            sectionIds[section.section_number] = this.lastID;
                        }
                    }
                );
            }

            insertSection.finalize(() => {
                // Insert code examples
                const insertCode = db.prepare(`
                    INSERT INTO code_examples (section_id, language, code, description, line_start)
                    VALUES (?, ?, ?, ?, ?)
                `);

                for (const code of testCodeExamples) {
                    const sectionId = sectionIds[code.section_number];
                    if (sectionId) {
                        insertCode.run(sectionId, 'verilog', code.code, code.description, null);
                    }
                }

                insertCode.finalize(() => {
                    // Insert tables
                    const insertTable = db.prepare(`
                        INSERT INTO tables (section_id, language, caption, content_json, markdown)
                        VALUES (?, ?, ?, ?, ?)
                    `);

                    for (const table of testTables) {
                        const sectionId = sectionIds[table.section_number];
                        if (sectionId) {
                            insertTable.run(sectionId, 'verilog', table.caption, table.content_json, table.markdown);
                        }
                    }

                    insertTable.finalize(() => {
                        // Insert metadata
                        db.run(
                            `INSERT INTO parse_metadata (language, pdf_path, pdf_hash, parse_date, docling_version, section_count, code_count, table_count, parse_duration_sec)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            ['verilog', 'test_data', 'test', Math.floor(Date.now() / 1000), '2.54.0', testSections.length, testCodeExamples.length, testTables.length, 0.1],
                            (err) => {
                                db.close((err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            }
                        );
                    });
                });
            });
        });
    });
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
    try {
        await fs.unlink(TEST_DB_PATH);
    } catch (error) {
        // File doesn't exist, that's fine
    }
}

/**
 * Setup test database (init + populate)
 */
export async function setupTestDatabase(): Promise<void> {
    await initTestDatabase();
    await populateTestDatabase();
}
