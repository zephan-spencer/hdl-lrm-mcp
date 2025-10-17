#!/usr/bin/env python3
"""
Athens HDL MCP - LRM Parser

Parses HDL Language Reference Manuals (PDFs) using Docling v2.54.0
and stores structured content in SQLite database.

Usage:
    python parse_lrm.py --pdf <path> --language <lang> --output <db_path>

Example:
    python parse_lrm.py --pdf data/lrms/LRM_V_2005.pdf --language verilog --output data/hdl-lrm.db
"""

import argparse
import sqlite3
import sys
import re
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

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
    """Parser for HDL Language Reference Manuals"""

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
            'tables': 0
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
        num_threads = max(4, cpu_count - 2)  # Leave 2 cores for system

        print(f"  Detected {cpu_count} CPU cores, using {num_threads} threads")

        # Configure accelerator for maximum CPU utilization
        accelerator_options = AcceleratorOptions(
            num_threads=num_threads,
            device=AcceleratorDevice.AUTO  # Auto-detect best device (CPU/CUDA/MPS)
        )

        # Configure PDF pipeline options
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = accelerator_options

        # Use ACCURATE mode for table extraction (maximum quality)
        pipeline_options.table_structure_options.mode = TableFormerMode.ACCURATE

        # Disable OCR since LRM PDFs are typically text-based (not scanned images)
        pipeline_options.do_ocr = False

        # Create converter with optimized settings
        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(
                    pipeline_options=pipeline_options
                )
            }
        )

        print("✓ Converter ready (optimized for CPU parallelization)")

    def parse_pdf(self):
        """Parse PDF using Docling"""
        print(f"\nParsing: {self.pdf_path}")
        print("This may take several minutes for large PDFs...")

        start_time = datetime.now()

        try:
            result = self.converter.convert(str(self.pdf_path))
            doc = result.document if hasattr(result, 'document') else result.legacy_document
        except Exception as e:
            raise RuntimeError(f"Docling parsing failed: {e}")

        duration = (datetime.now() - start_time).total_seconds()
        print(f"✓ Parsed in {duration:.1f}s")

        return doc, duration

    def extract_sections(self, doc) -> List[Dict]:
        """Extract hierarchical sections from markdown export"""
        print("\nExtracting sections...")

        # Export to markdown for easier parsing
        try:
            markdown = doc.export_to_markdown()
            print(f"  Exported {len(markdown)} chars to markdown")
        except Exception as e:
            print(f"  Warning: Could not export markdown: {e}")
            return []

        sections = []
        lines = markdown.split('\n')

        # Pattern for markdown headings
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$')
        # Pattern for section numbers
        section_num_pattern = re.compile(r'^(\d+(?:\.\d+)*)\s+(.+)$')

        current_section = None
        content_lines = []

        for i, line in enumerate(lines):
            match = heading_pattern.match(line)

            if match:
                # Save previous section
                if current_section:
                    current_section['content'] = '\n'.join(content_lines).strip()
                    sections.append(current_section)
                    content_lines = []

                # Parse new heading
                heading_text = match.group(2).strip()

                # Try to extract section number
                num_match = section_num_pattern.match(heading_text)
                if num_match:
                    section_number = num_match.group(1)
                    title = num_match.group(2).strip()

                    # Calculate depth and parent
                    depth = section_number.count('.')
                    parts = section_number.split('.')
                    parent = '.'.join(parts[:-1]) if depth > 0 else None

                    # Estimate page
                    page = max(1, i // 50)  # ~50 lines per page

                    current_section = {
                        'section_number': section_number,
                        'parent_section': parent,
                        'title': title,
                        'depth': depth,
                        'page_start': page,
                        'page_end': page
                    }
            elif current_section:
                # Accumulate content
                content_lines.append(line)

        # Don't forget last section
        if current_section:
            current_section['content'] = '\n'.join(content_lines).strip()
            sections.append(current_section)

        print(f"✓ Found {len(sections)} sections")
        return sections

    def extract_code_examples(self, doc, sections: List[Dict]) -> Dict[str, List[Dict]]:
        """Extract code examples from markdown export"""
        print("\nExtracting code examples...")

        code_by_section = {}

        try:
            markdown = doc.export_to_markdown()
        except Exception as e:
            print(f"  Warning: Could not export markdown: {e}")
            return code_by_section

        # Find code blocks in markdown (```language ... ```)
        code_block_pattern = re.compile(r'```(\w+)?\n(.*?)```', re.DOTALL)

        for match in code_block_pattern.finditer(markdown):
            lang_hint = match.group(1) or ''
            code = match.group(2).strip()

            # Skip empty or very short code blocks
            if len(code) < 10:
                continue

            # Find position to determine section
            pos = match.start()
            line_num = markdown[:pos].count('\n')
            page = max(1, line_num // 50)

            # Find closest section by page
            section_num = None
            for section in sections:
                if section['page_start'] <= page <= section['page_end']:
                    section_num = section['section_number']
                    break

            # If no match, assign to last section
            if not section_num and sections:
                section_num = sections[-1]['section_number']

            if section_num:
                if section_num not in code_by_section:
                    code_by_section[section_num] = []

                code_by_section[section_num].append({
                    'code': code,
                    'description': f'Code example ({lang_hint})' if lang_hint else None,
                    'line_start': line_num
                })

        total_code = sum(len(codes) for codes in code_by_section.values())
        print(f"✓ Found {total_code} code examples")
        return code_by_section

    def extract_tables(self, doc, sections: List[Dict]) -> Dict[str, List[Dict]]:
        """Extract tables using Docling's native table objects with deduplication"""
        print("\nExtracting tables...")

        tables_by_section = {}
        seen_table_hashes = set()  # Track seen tables to avoid duplicates
        duplicates_skipped = 0

        try:
            # Access Docling's table objects directly
            if hasattr(doc, 'tables'):
                docling_tables = doc.tables
            else:
                # Fallback: try to get from body items
                docling_tables = []
                if hasattr(doc, 'body') and hasattr(doc.body, 'children'):
                    for item in doc.body.children:
                        if hasattr(item, '__class__') and 'table' in item.__class__.__name__.lower():
                            docling_tables.append(item)

            print(f"  Found {len(docling_tables)} table objects from Docling")

            for table_obj in docling_tables:
                try:
                    # Extract table data
                    table_data = self._parse_table_object(table_obj)
                    
                    if not table_data:
                        continue

                    # Get page number for section mapping
                    page = self._get_table_page(table_obj)

                    # Find corresponding section
                    section_num = None
                    for section in sections:
                        if section['page_start'] <= page <= section['page_end']:
                            section_num = section['section_number']
                            break

                    if not section_num and sections:
                        section_num = sections[-1]['section_number']

                    if section_num:
                        # Create markdown representation
                        table_md = self._table_to_markdown(table_data)
                        
                        # Compute hash to detect duplicates
                        table_hash = hashlib.md5(table_md.encode('utf-8')).hexdigest()
                        
                        # Only add if not seen before
                        if table_hash not in seen_table_hashes:
                            seen_table_hashes.add(table_hash)
                            
                            if section_num not in tables_by_section:
                                tables_by_section[section_num] = []

                            tables_by_section[section_num].append({
                                'caption': table_data.get('caption'),
                                'content_json': json.dumps(table_data.get('rows', [])),
                                'markdown': table_md
                            })
                        else:
                            duplicates_skipped += 1

                except Exception as e:
                    print(f"  Warning: Failed to parse table: {e}")
                    continue

        except Exception as e:
            print(f"  Warning: Could not extract tables from Docling objects: {e}")
            print(f"  Falling back to markdown parsing...")
            return self._extract_tables_from_markdown(doc, sections)

        total_tables = sum(len(tables) for tables in tables_by_section.values())
        print(f"✓ Found {total_tables} unique tables (skipped {duplicates_skipped} duplicates)")
        return tables_by_section

    def _parse_table_object(self, table_obj) -> Optional[Dict]:
        """Parse a Docling table object into structured data"""
        try:
            # Try to get table data from various possible attributes
            if hasattr(table_obj, 'data') and table_obj.data:
                # Docling v2 format
                data = table_obj.data
                
                headers = []
                rows = []
                
                # Extract headers
                if hasattr(data, 'table_cells'):
                    # Parse from cell structure
                    cells = data.table_cells
                    # Group by row
                    rows_dict = {}
                    for cell in cells:
                        row_idx = cell.row_span[0] if hasattr(cell, 'row_span') else 0
                        if row_idx not in rows_dict:
                            rows_dict[row_idx] = []
                        rows_dict[row_idx].append(cell.text if hasattr(cell, 'text') else str(cell))
                    
                    # First row is typically headers
                    if 0 in rows_dict:
                        headers = rows_dict[0]
                        rows = [rows_dict[i] for i in sorted(rows_dict.keys()) if i > 0]
                
                elif hasattr(data, 'grid'):
                    # Grid format
                    grid = data.grid
                    if grid and len(grid) > 0:
                        headers = grid[0] if len(grid) > 0 else []
                        rows = grid[1:] if len(grid) > 1 else []
                
                # Get caption
                caption = None
                if hasattr(table_obj, 'caption') and table_obj.caption:
                    caption = str(table_obj.caption)
                
                return {
                    'caption': caption,
                    'headers': headers,
                    'rows': rows
                }
            
            return None
            
        except Exception as e:
            print(f"    Error parsing table object: {e}")
            return None

    def _get_table_page(self, table_obj) -> int:
        """Get page number for a table object"""
        try:
            if hasattr(table_obj, 'prov') and hasattr(table_obj.prov, 'page_no'):
                return table_obj.prov.page_no
            elif hasattr(table_obj, 'page'):
                return table_obj.page
        except:
            pass
        return 1

    def _table_to_markdown(self, table_data: Dict) -> str:
        """Convert table data to clean markdown format"""
        headers = table_data.get('headers', [])
        rows = table_data.get('rows', [])
        
        if not headers and not rows:
            return ""
        
        # Build markdown table
        lines = []
        
        # Header row
        if headers:
            header_row = '| ' + ' | '.join(str(h) for h in headers) + ' |'
            lines.append(header_row)
            
            # Separator row
            separator = '|' + '|'.join(['---' for _ in headers]) + '|'
            lines.append(separator)
        
        # Data rows
        for row in rows:
            # Ensure row has same number of columns as headers
            if headers:
                row = list(row) + [''] * (len(headers) - len(row))
                row = row[:len(headers)]
            
            row_str = '| ' + ' | '.join(str(cell) for cell in row) + ' |'
            lines.append(row_str)
        
        return '\n'.join(lines)

    def _extract_tables_from_markdown(self, doc, sections: List[Dict]) -> Dict[str, List[Dict]]:
        """Fallback: Extract tables from markdown export"""
        tables_by_section = {}
        seen_table_hashes = set()

        try:
            markdown = doc.export_to_markdown()
        except Exception as e:
            print(f"  Warning: Could not export markdown: {e}")
            return tables_by_section

        # Find markdown tables (lines with | separators)
        lines = markdown.split('\n')
        i = 0
        duplicates_skipped = 0
        
        while i < len(lines):
            line = lines[i]

            # Check if this looks like a table row
            if '|' in line and line.strip().startswith('|'):
                # Collect table lines
                table_lines = [line]
                j = i + 1
                while j < len(lines) and '|' in lines[j]:
                    table_lines.append(lines[j])
                    j += 1

                # Must have at least header + separator + 1 row
                if len(table_lines) >= 3:
                    page = max(1, i // 50)

                    # Find section by page
                    section_num = None
                    for section in sections:
                        if section['page_start'] <= page <= section['page_end']:
                            section_num = section['section_number']
                            break

                    if not section_num and sections:
                        section_num = sections[-1]['section_number']

                    if section_num:
                        table_md = '\n'.join(table_lines)
                        
                        # Compute hash to detect duplicates
                        table_hash = hashlib.md5(table_md.encode('utf-8')).hexdigest()
                        
                        # Only add if not seen before
                        if table_hash not in seen_table_hashes:
                            seen_table_hashes.add(table_hash)
                            
                            if section_num not in tables_by_section:
                                tables_by_section[section_num] = []

                            tables_by_section[section_num].append({
                                'caption': None,
                                'content_json': json.dumps([]),
                                'markdown': table_md
                            })
                        else:
                            duplicates_skipped += 1

                i = j
            else:
                i += 1

        total_tables = sum(len(tables) for tables in tables_by_section.values())
        print(f"✓ Found {total_tables} unique tables via markdown (skipped {duplicates_skipped} duplicates)")
        return tables_by_section

    def store_in_database(self, sections: List[Dict], code_by_section: Dict, tables_by_section: Dict, parse_duration: float):
        """Store parsed data in SQLite database"""
        print("\nStoring in database...")

        # Connect to database
        self.db = sqlite3.connect(str(self.db_path))
        cursor = self.db.cursor()

        try:
            # Delete existing data for this language (CASCADE will handle related tables)
            cursor.execute("SELECT COUNT(*) FROM sections WHERE language = ?", (self.language,))
            existing_count = cursor.fetchone()[0]

            if existing_count > 0:
                print(f"  Removing {existing_count} existing sections for '{self.language}'...")
                cursor.execute("DELETE FROM sections WHERE language = ?", (self.language,))
                print(f"  ✓ Cleaned up existing data")

            # Check for duplicate section numbers in parsed data
            from collections import Counter
            section_nums = [s['section_number'] for s in sections]
            duplicates = {num: count for num, count in Counter(section_nums).items() if count > 1}

            if duplicates:
                print(f"  ⚠ Warning: Found {len(duplicates)} duplicate section numbers")
                print(f"    Sample duplicates: {list(duplicates.items())[:3]}")
                print(f"    Keeping only the first occurrence of each section")

                # Deduplicate: keep only first occurrence
                seen = set()
                unique_sections = []
                for section in sections:
                    if section['section_number'] not in seen:
                        seen.add(section['section_number'])
                        unique_sections.append(section)
                sections = unique_sections
                print(f"  ✓ Reduced to {len(sections)} unique sections")

            # Store sections and get their IDs
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
                docling_version,
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

            # Step 3: Extract sections
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
            print(f"  Total Time:     {total_time:.1f}s")
            print(f"  Database:       {self.db_path}")
            print("=" * 70)

        except Exception as e:
            print(f"\n✗ Error: {e}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Parse HDL Language Reference Manual (LRM) PDF using Docling'
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
