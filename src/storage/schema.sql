-- Athens HDL MCP Database Schema
-- Version: 2.0 (Clean Slate)
-- Date: 2025-09-29
-- SQLite with FTS5 for full-text search

-- =============================================================================
-- Core Tables
-- =============================================================================

-- sections: Primary content storage
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,              -- 'verilog' | 'systemverilog' | 'vhdl'
    section_number TEXT NOT NULL,        -- '3.2.1'
    parent_section TEXT,                 -- '3.2' or NULL for top-level
    title TEXT NOT NULL,                 -- 'Lexical Conventions'
    content TEXT NOT NULL,               -- Full text content of section
    page_start INTEGER NOT NULL,         -- Starting page number
    page_end INTEGER NOT NULL,           -- Ending page number
    depth INTEGER NOT NULL,              -- Hierarchy depth (0, 1, 2, ...)
    UNIQUE(language, section_number)
);

-- code_examples: Code snippets extracted from LRM
CREATE TABLE IF NOT EXISTS code_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    language TEXT NOT NULL,              -- 'verilog' | 'systemverilog' | 'vhdl'
    code TEXT NOT NULL,                  -- The actual code snippet
    description TEXT,                    -- Optional caption/description
    line_start INTEGER,                  -- Position within section
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- tables: Extracted tables from PDF
CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    language TEXT NOT NULL,              -- 'verilog' | 'systemverilog' | 'vhdl'
    caption TEXT,                        -- Table title/caption
    content_json TEXT NOT NULL,          -- JSON array of rows
    markdown TEXT NOT NULL,              -- Rendered as markdown table
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- parse_metadata: Track parsing history and statistics
CREATE TABLE IF NOT EXISTS parse_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    pdf_hash TEXT,                       -- SHA256 hash of PDF file
    parse_date INTEGER NOT NULL,         -- Unix timestamp
    docling_version TEXT,
    section_count INTEGER,
    code_count INTEGER,
    table_count INTEGER,
    parse_duration_sec REAL
);

-- section_embeddings: Semantic search embeddings for sections
CREATE TABLE IF NOT EXISTS section_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    language TEXT NOT NULL,
    embedding_model TEXT NOT NULL,       -- e.g., 'all-mpnet-base-v2'
    embedding_json TEXT NOT NULL,        -- JSON array of floats (768-dim for mpnet)
    created_at INTEGER NOT NULL,         -- Unix timestamp
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
    UNIQUE(section_id, embedding_model)
);

-- =============================================================================
-- Full-Text Search (FTS5)
-- =============================================================================

-- FTS5 virtual table for full-text search on sections
CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts USING fts5(
    section_number,
    title,
    content,
    content='sections',                  -- Link to sections table
    content_rowid='id'                   -- Use sections.id as rowid
);

-- =============================================================================
-- Triggers for FTS5 Synchronization
-- =============================================================================

-- Trigger: Insert into sections -> insert into sections_fts
CREATE TRIGGER IF NOT EXISTS sections_ai AFTER INSERT ON sections BEGIN
    INSERT INTO sections_fts(rowid, section_number, title, content)
    VALUES (new.id, new.section_number, new.title, new.content);
END;

-- Trigger: Delete from sections -> delete from sections_fts
CREATE TRIGGER IF NOT EXISTS sections_ad AFTER DELETE ON sections BEGIN
    INSERT INTO sections_fts(sections_fts, rowid, section_number, title, content)
    VALUES('delete', old.id, old.section_number, old.title, old.content);
END;

-- Trigger: Update sections -> update sections_fts
CREATE TRIGGER IF NOT EXISTS sections_au AFTER UPDATE ON sections BEGIN
    INSERT INTO sections_fts(sections_fts, rowid, section_number, title, content)
    VALUES('delete', old.id, old.section_number, old.title, old.content);
    INSERT INTO sections_fts(rowid, section_number, title, content)
    VALUES (new.id, new.section_number, new.title, new.content);
END;

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sections_language ON sections(language);
CREATE INDEX IF NOT EXISTS idx_sections_section_number ON sections(section_number);
CREATE INDEX IF NOT EXISTS idx_sections_parent ON sections(parent_section);
CREATE INDEX IF NOT EXISTS idx_code_section ON code_examples(section_id);
CREATE INDEX IF NOT EXISTS idx_code_language ON code_examples(language);
CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section_id);
CREATE INDEX IF NOT EXISTS idx_tables_language ON tables(language);
CREATE INDEX IF NOT EXISTS idx_parse_language ON parse_metadata(language);
CREATE INDEX IF NOT EXISTS idx_embeddings_section ON section_embeddings(section_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_language ON section_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON section_embeddings(embedding_model);

-- =============================================================================
-- Schema Version
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_version (version, applied_at)
VALUES ('2.0.0', strftime('%s', 'now'));
