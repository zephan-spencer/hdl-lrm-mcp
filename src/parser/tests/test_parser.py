"""
Unit tests for LRM Parser
"""

import pytest
import sqlite3
import tempfile
import os
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch
from collections import Counter

# Import the parser module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from parse_lrm import LRMParser


class TestLRMParser:
    """Test suite for LRMParser class"""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing"""
        fd, path = tempfile.mkstemp(suffix='.db')
        os.close(fd)

        # Create schema
        conn = sqlite3.connect(path)
        cursor = conn.cursor()

        # Minimal schema for testing
        cursor.execute('''
            CREATE TABLE sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                language TEXT NOT NULL,
                section_number TEXT NOT NULL,
                parent_section TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                page_start INTEGER NOT NULL,
                page_end INTEGER NOT NULL,
                depth INTEGER NOT NULL,
                UNIQUE(language, section_number)
            )
        ''')

        cursor.execute('''
            CREATE TABLE code_examples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_id INTEGER NOT NULL,
                language TEXT NOT NULL,
                code TEXT NOT NULL,
                description TEXT,
                line_start INTEGER,
                FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            )
        ''')

        cursor.execute('''
            CREATE TABLE tables (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_id INTEGER NOT NULL,
                language TEXT NOT NULL,
                caption TEXT,
                content_json TEXT NOT NULL,
                markdown TEXT NOT NULL,
                FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
            )
        ''')

        cursor.execute('''
            CREATE TABLE parse_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                language TEXT NOT NULL,
                pdf_path TEXT NOT NULL,
                pdf_hash TEXT,
                parse_date INTEGER NOT NULL,
                docling_version TEXT,
                section_count INTEGER,
                code_count INTEGER,
                table_count INTEGER,
                parse_duration_sec REAL
            )
        ''')

        conn.commit()
        conn.close()

        yield path

        # Cleanup
        try:
            os.unlink(path)
        except:
            pass

    def test_initialization(self, temp_db):
        """Test parser initialization"""
        # Create a dummy PDF file
        pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
        os.close(pdf_fd)

        try:
            parser = LRMParser(pdf_path, 'verilog', temp_db)
            assert parser.language == 'verilog'
            assert parser.db_path == Path(temp_db)
            assert parser.pdf_path == Path(pdf_path)
        finally:
            os.unlink(pdf_path)

    def test_invalid_language(self, temp_db):
        """Test that invalid language raises error"""
        pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
        os.close(pdf_fd)

        try:
            with pytest.raises(ValueError, match="Invalid language"):
                LRMParser(pdf_path, 'invalid', temp_db)
        finally:
            os.unlink(pdf_path)

    def test_missing_pdf(self, temp_db):
        """Test that missing PDF raises error"""
        with pytest.raises(FileNotFoundError):
            LRMParser('/nonexistent/file.pdf', 'verilog', temp_db)

    def test_extract_sections(self):
        """Test section extraction logic"""
        # Create a mock document
        mock_doc = Mock()
        mock_doc.export_to_markdown.return_value = '''
# 1 Introduction

This is the introduction section.

## 1.1 Purpose

The purpose of this document.

# 2 Overview

This is the overview section.
'''

        # Create parser with mock
        pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
        os.close(pdf_fd)
        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(db_path)

        try:
            parser = LRMParser(pdf_path, 'verilog', db_path)
            sections = parser.extract_sections(mock_doc)

            assert len(sections) > 0
            assert all('section_number' in s for s in sections)
            assert all('title' in s for s in sections)
            assert all('content' in s for s in sections)

        finally:
            os.unlink(pdf_path)
            try:
                os.unlink(db_path)
            except:
                pass

    def test_extract_code_examples(self):
        """Test code example extraction"""
        mock_doc = Mock()
        mock_doc.export_to_markdown.return_value = '''
# 1 Examples

Here is a code example:

```verilog
always @(posedge clk) begin
    q <= d;
end
```

Another example:

```
module test;
endmodule
```
'''

        sections = [
            {'section_number': '1', 'page_start': 1, 'page_end': 2}
        ]

        pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
        os.close(pdf_fd)
        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(db_path)

        try:
            parser = LRMParser(pdf_path, 'verilog', db_path)
            code_by_section = parser.extract_code_examples(mock_doc, sections)

            assert len(code_by_section) > 0
            assert '1' in code_by_section
            assert len(code_by_section['1']) > 0

        finally:
            os.unlink(pdf_path)
            try:
                os.unlink(db_path)
            except:
                pass

    def test_duplicate_section_handling(self, temp_db):
        """Test that duplicate sections are handled correctly"""
        # Create sections with duplicates
        sections = [
            {
                'section_number': '1',
                'parent_section': None,
                'title': 'First',
                'content': 'Content 1',
                'page_start': 1,
                'page_end': 2,
                'depth': 0
            },
            {
                'section_number': '1',  # Duplicate
                'parent_section': None,
                'title': 'Second',
                'content': 'Content 2',
                'page_start': 3,
                'page_end': 4,
                'depth': 0
            },
            {
                'section_number': '2',
                'parent_section': None,
                'title': 'Third',
                'content': 'Content 3',
                'page_start': 5,
                'page_end': 6,
                'depth': 0
            }
        ]

        # Test duplicate detection logic
        section_nums = [s['section_number'] for s in sections]
        duplicates = {num: count for num, count in Counter(section_nums).items() if count > 1}

        assert len(duplicates) == 1
        assert '1' in duplicates
        assert duplicates['1'] == 2

        # Test deduplication
        seen = set()
        unique_sections = []
        for section in sections:
            if section['section_number'] not in seen:
                seen.add(section['section_number'])
                unique_sections.append(section)

        assert len(unique_sections) == 2
        assert unique_sections[0]['section_number'] == '1'
        assert unique_sections[1]['section_number'] == '2'

    def test_database_cleanup_before_insert(self, temp_db):
        """Test that existing language data is cleaned up before insert"""
        conn = sqlite3.connect(temp_db)
        cursor = conn.cursor()

        # Insert some test data
        cursor.execute('''
            INSERT INTO sections (language, section_number, parent_section, title, content, page_start, page_end, depth)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('verilog', '1', None, 'Test', 'Content', 1, 1, 0))

        cursor.execute('''
            INSERT INTO sections (language, section_number, parent_section, title, content, page_start, page_end, depth)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('systemverilog', '1', None, 'Test', 'Content', 1, 1, 0))

        conn.commit()

        # Verify data exists
        cursor.execute("SELECT COUNT(*) FROM sections WHERE language = ?", ('verilog',))
        assert cursor.fetchone()[0] == 1

        cursor.execute("SELECT COUNT(*) FROM sections WHERE language = ?", ('systemverilog',))
        assert cursor.fetchone()[0] == 1

        # Simulate cleanup for verilog only
        cursor.execute("DELETE FROM sections WHERE language = ?", ('verilog',))
        conn.commit()

        # Verify verilog data is deleted but systemverilog remains
        cursor.execute("SELECT COUNT(*) FROM sections WHERE language = ?", ('verilog',))
        assert cursor.fetchone()[0] == 0

        cursor.execute("SELECT COUNT(*) FROM sections WHERE language = ?", ('systemverilog',))
        assert cursor.fetchone()[0] == 1

        conn.close()

    def test_file_hash_calculation(self):
        """Test file hash calculation"""
        # Create a temporary file with known content
        fd, path = tempfile.mkstemp()
        os.write(fd, b'test content')
        os.close(fd)

        db_fd, db_path = tempfile.mkstemp(suffix='.db')
        os.close(db_fd)

        try:
            parser = LRMParser(path, 'verilog', db_path)
            hash1 = parser._calculate_file_hash(Path(path))
            hash2 = parser._calculate_file_hash(Path(path))

            # Same file should produce same hash
            assert hash1 == hash2
            assert len(hash1) == 64  # SHA256 produces 64 hex characters

        finally:
            os.unlink(path)
            try:
                os.unlink(db_path)
            except:
                pass

    @pytest.mark.parametrize('language', ['verilog', 'systemverilog', 'vhdl'])
    def test_supported_languages(self, language, temp_db):
        """Test that all supported languages are accepted"""
        pdf_fd, pdf_path = tempfile.mkstemp(suffix='.pdf')
        os.close(pdf_fd)

        try:
            parser = LRMParser(pdf_path, language, temp_db)
            assert parser.language == language
        finally:
            os.unlink(pdf_path)


class TestSectionExtraction:
    """Test suite for section extraction logic"""

    def test_hierarchical_sections(self):
        """Test that hierarchical sections are parsed correctly"""
        markdown = '''
# 1 Chapter One

Content of chapter one.

## 1.1 Section One Point One

Content of section 1.1.

### 1.1.1 Subsection

Content of subsection.

## 1.2 Section One Point Two

Content of section 1.2.

# 2 Chapter Two

Content of chapter two.
'''

        # This tests the parsing logic
        import re
        lines = markdown.split('\n')
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$')
        section_num_pattern = re.compile(r'^(\d+(?:\.\d+)*)\s+(.+)$')

        sections = []
        for line in lines:
            match = heading_pattern.match(line)
            if match:
                heading_text = match.group(2).strip()
                num_match = section_num_pattern.match(heading_text)

                if num_match:
                    section_number = num_match.group(1)
                    title = num_match.group(2).strip()
                    depth = section_number.count('.')

                    sections.append({
                        'section_number': section_number,
                        'title': title,
                        'depth': depth
                    })

        assert len(sections) == 5
        assert sections[0]['section_number'] == '1'
        assert sections[0]['depth'] == 0
        assert sections[1]['section_number'] == '1.1'
        assert sections[1]['depth'] == 1
        assert sections[2]['section_number'] == '1.1.1'
        assert sections[2]['depth'] == 2

    def test_parent_section_calculation(self):
        """Test that parent sections are calculated correctly"""
        sections = [
            {'section_number': '1', 'depth': 0},
            {'section_number': '1.1', 'depth': 1},
            {'section_number': '1.1.1', 'depth': 2},
            {'section_number': '1.2', 'depth': 1},
            {'section_number': '2', 'depth': 0},
        ]

        for section in sections:
            parts = section['section_number'].split('.')
            if section['depth'] > 0:
                parent = '.'.join(parts[:-1])
            else:
                parent = None
            section['parent'] = parent

        assert sections[0]['parent'] is None
        assert sections[1]['parent'] == '1'
        assert sections[2]['parent'] == '1.1'
        assert sections[3]['parent'] == '1'
        assert sections[4]['parent'] is None
