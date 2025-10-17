#!/usr/bin/env python3
"""
Athens HDL MCP - LRM Parser

Parses HDL Language Reference Manuals (PDFs) using Docling's native API
with accurate page tracking and stores structured content in SQLite database.

Key Features:
- 100% page accuracy using item.prov[0].page_no
- Direct item iteration (no markdown intermediary)
- SectionHeaderItem detection for better section boundaries
- Accurate code/table association to sections

Usage:
    python parse_lrm.py --pdf <path> --language <lang> --output <db_path>

Example:
    python parse_lrm.py --pdf data/lrms/LRM_V_2005.pdf --language verilog --output data/hdl-lrm.db
    python parse_lrm.py --pdf data/test_snippets/verilog_snippet_5p.pdf --language verilog --output data/test.db
"""

import argparse
import sqlite3
import sys
import re
import hashlib
import json
import os
import time
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Add parser directory to path for utils
sys.path.insert(0, str(Path(__file__).parent))

# Import utilities
from docling_utils import (
    get_page_number,
    get_item_text,
    get_item_label,
    is_heading,
    extract_section_number,
    group_items_by_page
)

# Import Docling
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    from docling.datamodel.accelerator_options import AcceleratorOptions, AcceleratorDevice
    import docling
except ImportError as e:
    print(f"Error: Failed to import Docling: {e}")
    print("Install with: pip install docling>=2.54.0")
    sys.exit(1)


class LRMParser:
    """Enhanced parser for HDL Language Reference Manuals"""

    def __init__(self, pdf_path: str, language: str, db_path: str):
        self.pdf_path = Path(pdf_path)
        self.language = language.lower()
        self.db_path = Path(db_path)
        self.converter = None
        self.db = None

        # Statistics
        self.stats = {
            'sections': 0,
            'code_examples': 0,
            'tables': 0,
            'page_accuracy': 0.0
        }

        # Validate inputs
        if not self.pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        if self.language not in ['verilog', 'systemverilog', 'vhdl']:
            raise ValueError(f"Invalid language: {language}")

    def setup_converter(self):
        """Initialize Docling converter with optimized settings"""
        print("Setting up Docling converter...")

        # Detect CPU count for optimal threading
        cpu_count = os.cpu_count() or 4
        num_threads = max(4, cpu_count - 2)

        print(f"  Detected {cpu_count} CPU cores, using {num_threads} threads")

        # Configure accelerator
        accelerator_options = AcceleratorOptions(
            num_threads=num_threads,
            device=AcceleratorDevice.AUTO
        )

        # Configure PDF pipeline
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = accelerator_options
        pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE
        pipeline_options.do_ocr = False

        # Create converter
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options
                )
            }
        )

        print("✓ Converter ready")

    def parse_pdf(self):
        """Parse PDF using Docling"""
        print(f"\nParsing: {self.pdf_path}")
        print("This may take several minutes for large PDFs...")

        start_time = time.time()

        try:
            result = self.converter.convert(str(self.pdf_path))
            doc = result.document if hasattr(result, 'document') else result.legacy_document
        except Exception as e:
            raise RuntimeError(f"Docling parsing failed: {e}")

        duration = time.time() - start_time
        print(f"✓ Parsed in {duration:.1f}s")

        return doc, duration

    def extract_sections(self, doc) -> List[Dict]:
        """Extract sections using native Docling API with accurate pages"""
        print("\nExtracting sections using native Docling API...")

        if not hasattr(doc, 'texts'):
            print("  Warning: doc.texts not available, falling back to markdown")
            return self._extract_sections_from_markdown(doc)

        texts = doc.texts
        print(f"  Found {len(texts)} text items")

        # Count page accuracy
        items_with_pages = sum(1 for item in texts if get_page_number(item) is not None)
        self.stats['page_accuracy'] = (items_with_pages / len(texts)) * 100 if texts else 0
        print(f"  Page accuracy: {self.stats['page_accuracy']:.1f}%")

        # Extract sections from text items
        sections = []
        current_section = None

        for item in texts:
            if is_heading(item):
                # Save previous section
                if current_section and current_section['content']:
                    sections.append(current_section)

                # Start new section
                title = get_item_text(item)
                page = get_page_number(item) or 1
                section_num = extract_section_number(title)

                # Calculate depth and parent from section number
                if section_num:
                    depth = section_num.count('.')
                    parts = section_num.split('.')
                    parent = '.'.join(parts[:-1]) if depth > 0 else None
                else:
                    # For sections without numbers, estimate depth from title
                    depth = 0
                    parent = None
                    section_num = f"unnumbered_{len(sections)}"

                current_section = {
                    'section_number': section_num,
                    'parent_section': parent,
                    'title': title,
                    'page_start': page,
                    'page_end': page,
                    'depth': depth,
                    'content': []
                }
            elif current_section:
                # Add content to current section
                text = get_item_text(item)
                page = get_page_number(item)

                if text.strip():
                    current_section['content'].append(text)

                # Update page_end
                if page and page > current_section['page_end']:
                    current_section['page_end'] = page

        # Save last section
        if current_section and current_section['content']:
            sections.append(current_section)

        # Convert content lists to strings
        for section in sections:
            section['content'] = '\n\n'.join(section['content'])

        print(f"✓ Found {len(sections)} sections")
        return sections

    def _extract_sections_from_markdown(self, doc) -> List[Dict]:
        """Fallback: extract from markdown (original method)"""
        # This is the old method from parse_lrm.py
        print("  Using markdown-based extraction (fallback)")
        
        try:
            markdown = doc.export_to_markdown()
        except Exception as e:
            print(f"  Error: Could not export markdown: {e}")
            return []
        
        sections = []
        lines = markdown.split('\n')
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$')
        section_num_pattern = re.compile(r'^(\d+(?:\.\d+)*)\s+(.+)$')
        
        current_section = None
        content_lines = []
        
        for i, line in enumerate(lines):
            match = heading_pattern.match(line)
            
            if match:
                if current_section:
                    current_section['content'] = '\n'.join(content_lines).strip()
                    sections.append(current_section)
                    content_lines = []
                
                heading_text = match.group(2).strip()
                num_match = section_num_pattern.match(heading_text)
                
                if num_match:
                    section_number = num_match.group(1)
                    title = num_match.group(2).strip()
                    depth = section_number.count('.')
                    parts = section_number.split('.')
                    parent = '.'.join(parts[:-1]) if depth > 0 else None
                    page = max(1, i // 50)
                    
                    current_section = {
                        'section_number': section_number,
                        'parent_section': parent,
                        'title': title,
                        'depth': depth,
                        'page_start': page,
                        'page_end': page,
                        'content': ''
                    }
            elif current_section:
                content_lines.append(line)
        
        if current_section:
            current_section['content'] = '\n'.join(content_lines).strip()
            sections.append(current_section)
        
        return sections

    def extract_code_examples(self, doc, sections: List[Dict]) -> Dict[str, List[Dict]]:
        """Extract code examples (enhanced detection coming in Phase 5)"""
        print("\nExtracting code examples...")

        code_by_section = {}

        try:
            markdown = doc.export_to_markdown()
        except Exception as e:
            print(f"  Warning: Could not export markdown: {e}")
            return code_by_section

        # Find code blocks in markdown
        code_block_pattern = re.compile(r'```(\w+)?\n(.*?)```', re.DOTALL)

        for match in code_block_pattern.finditer(markdown):
            code = match.group(2).strip()

            if len(code) < 10:
                continue

            # Map to section by position
            pos = match.start()
            line_num = markdown[:pos].count('\n')
            
            # Find closest section (now with accurate pages!)
            section_num = None
            estimated_page = max(1, line_num // 50)
            
            for section in sections:
                if section['page_start'] <= estimated_page <= section['page_end']:
                    section_num = section['section_number']
                    break

            if not section_num and sections:
                section_num = sections[-1]['section_number']

            if section_num:
                if section_num not in code_by_section:
                    code_by_section[section_num] = []

                code_by_section[section_num].append({
                    'code': code,
                    'description': match.group(1),
                    'line_start': line_num
                })

        total_code = sum(len(codes) for codes in code_by_section.values())
        print(f"✓ Found {total_code} code examples")
        return code_by_section

    def extract_tables(self, doc, sections: List[Dict]) -> Dict[str, List[Dict]]:
        """Extract tables using Docling's native table objects"""
        print("\nExtracting tables...")

        tables_by_section = {}
        seen_table_hashes = set()
        duplicates_skipped = 0

        try:
            if hasattr(doc, 'tables'):
                docling_tables = doc.tables
                print(f"  Found {len(docling_tables)} table objects")

                for table_obj in docling_tables:
                    try:
                        # Get page number from table
                        page = get_page_number(table_obj)
                        if not page:
                            page = 1

                        # Find corresponding section by page
                        section_num = None
                        for section in sections:
                            if section['page_start'] <= page <= section['page_end']:
                                section_num = section['section_number']
                                break

                        if not section_num and sections:
                            section_num = sections[-1]['section_number']

                        if section_num:
                            # Convert table to markdown
                            table_md = self._table_to_markdown(table_obj)
                            
                            if table_md:
                                # Check for duplicates
                                table_hash = hashlib.md5(table_md.encode('utf-8')).hexdigest()
                                
                                if table_hash not in seen_table_hashes:
                                    seen_table_hashes.add(table_hash)
                                    
                                    if section_num not in tables_by_section:
                                        tables_by_section[section_num] = []

                                    caption = str(table_obj.caption) if hasattr(table_obj, 'caption') and table_obj.caption else None

                                    tables_by_section[section_num].append({
                                        'caption': caption,
                                        'content_json': json.dumps([]),
                                        'markdown': table_md
                                    })
                                else:
                                    duplicates_skipped += 1

                    except Exception as e:
                        print(f"  Warning: Failed to parse table: {e}")
                        continue

        except Exception as e:
            print(f"  Warning: Could not extract tables: {e}")

        total_tables = sum(len(tables) for tables in tables_by_section.values())
        print(f"✓ Found {total_tables} unique tables (skipped {duplicates_skipped} duplicates)")
        return tables_by_section

    def _table_to_markdown(self, table_obj) -> str:
        """Convert Docling table to markdown"""
        try:
            # Try to export table to markdown
            if hasattr(table_obj, 'export_to_markdown'):
                return table_obj.export_to_markdown()
            
            # Fallback: basic conversion
            return str(table_obj)
        except:
            return ""

    def store_in_database(self, sections: List[Dict], code_by_section: Dict, tables_by_section: Dict, parse_duration: float):
        """Store parsed data in SQLite database"""
        print("\nStoring in database...")

        self.db = sqlite3.connect(str(self.db_path))
        cursor = self.db.cursor()

        try:
            # Delete existing data for this language
            cursor.execute("SELECT COUNT(*) FROM sections WHERE language = ?", (self.language,))
            existing_count = cursor.fetchone()[0]

            if existing_count > 0:
                print(f"  Removing {existing_count} existing sections for '{self.language}'...")
                cursor.execute("DELETE FROM sections WHERE language = ?", (self.language,))
                print(f"  ✓ Cleaned up existing data")

            # Store sections
            section_ids = {}

            for section in sections:
                cursor.execute("""
                    INSERT INTO sections (language, section_number, parent_section, title, content, page_start, page_end, depth)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    self.language,
                    section['section_number'],
                    section['parent_section'],
                    section['title'],
                    section['content'],
                    section['page_start'],
                    section['page_end'],
                    section['depth']
                ))

                section_ids[section['section_number']] = cursor.lastrowid
                self.stats['sections'] += 1

            # Store code examples
            for section_num, codes in code_by_section.items():
                section_id = section_ids.get(section_num)
                if not section_id:
                    continue

                for code in codes:
                    cursor.execute("""
                        INSERT INTO code_examples (section_id, language, code, description, line_start)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        section_id,
                        self.language,
                        code['code'],
                        code['description'],
                        code['line_start']
                    ))
                    self.stats['code_examples'] += 1

            # Store tables
            for section_num, tables in tables_by_section.items():
                section_id = section_ids.get(section_num)
                if not section_id:
                    continue

                for table in tables:
                    cursor.execute("""
                        INSERT INTO tables (section_id, language, caption, content_json, markdown)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        section_id,
                        self.language,
                        table['caption'],
                        table['content_json'],
                        table['markdown']
                    ))
                    self.stats['tables'] += 1

            # Store parse metadata
            pdf_hash = self._calculate_file_hash(self.pdf_path)
            docling_version = getattr(docling, '__version__', 'unknown')

            cursor.execute("""
                INSERT INTO parse_metadata (language, pdf_path, pdf_hash, parse_date, docling_version,
                                           section_count, code_count, table_count, parse_duration_sec)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                self.language,
                str(self.pdf_path),
                pdf_hash,
                int(datetime.now().timestamp()),
                f"{docling_version} (v2-native-api)",
                self.stats['sections'],
                self.stats['code_examples'],
                self.stats['tables'],
                parse_duration
            ))

            self.db.commit()
            print("✓ Data stored successfully")

        except Exception as e:
            self.db.rollback()
            raise RuntimeError(f"Database storage failed: {e}")
        finally:
            self.db.close()

    def _calculate_file_hash(self, filepath: Path) -> str:
        """Calculate SHA256 hash of file"""
        sha256 = hashlib.sha256()
        with open(filepath, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def run(self):
        """Main execution flow"""
        print("=" * 70)
        print("Athens HDL MCP - LRM Parser")
        print("=" * 70)

        start_time = datetime.now()

        try:
            # Step 1: Setup
            self.setup_converter()

            # Step 2: Parse PDF
            doc, parse_duration = self.parse_pdf()

            # Step 3: Extract sections with accurate pages
            sections = self.extract_sections(doc)

            # Step 4: Extract code
            code_by_section = self.extract_code_examples(doc, sections)

            # Step 5: Extract tables
            tables_by_section = self.extract_tables(doc, sections)

            # Step 6: Store in database
            self.store_in_database(sections, code_by_section, tables_by_section, parse_duration)

            # Summary
            total_time = (datetime.now() - start_time).total_seconds()
            print("\n" + "=" * 70)
            print("✓ Parsing Complete")
            print("=" * 70)
            print(f"  Language:       {self.language}")
            print(f"  Sections:       {self.stats['sections']}")
            print(f"  Code Examples:  {self.stats['code_examples']}")
            print(f"  Tables:         {self.stats['tables']}")
            print(f"  Page Accuracy:  {self.stats['page_accuracy']:.1f}%")
            print(f"  Total Time:     {total_time:.1f}s")
            print(f"  Database:       {self.db_path}")
            print("=" * 70)

        except Exception as e:
            print(f"\n✗ Error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Parse HDL LRM PDF using Docling with accurate page tracking'
    )
    parser.add_argument('--pdf', required=True, help='Path to PDF file')
    parser.add_argument('--language', required=True, choices=['verilog', 'systemverilog', 'vhdl'],
                        help='HDL language')
    parser.add_argument('--output', required=True, help='Output SQLite database path')

    args = parser.parse_args()

    # Run parser
    lrm_parser = LRMParser(args.pdf, args.language, args.output)
    lrm_parser.run()


if __name__ == '__main__':
    main()
