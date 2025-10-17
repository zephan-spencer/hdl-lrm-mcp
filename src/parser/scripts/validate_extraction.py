#!/usr/bin/env python3
"""
Validate extracted LRM data quality.

Checks for common issues:
- Section hierarchy integrity
- Page number accuracy
- Duplicate sections
- Missing parent references
- Code/table association quality

Usage:
    python validate_extraction.py --db data/hdl-lrm.db
    python validate_extraction.py --db data/hdl-lrm.db --language verilog
    python validate_extraction.py --db data/hdl-lrm.db --detailed
"""

import argparse
import sqlite3
import sys
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, List, Tuple


class ExtractionValidator:
    """Validate parsed LRM data quality"""

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {db_path}")

        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row

        self.issues = {
            'critical': [],
            'warning': [],
            'info': []
        }

        self.stats = {}

    def validate_all(self, language: str = None) -> Dict:
        """Run all validation checks"""
        print("=" * 70)
        print("LRM Extraction Validation")
        print("=" * 70)
        print(f"Database: {self.db_path}")
        if language:
            print(f"Language: {language}")
        print()

        # Run validation checks
        self.check_section_hierarchy(language)
        self.check_duplicates(language)
        self.check_page_numbers(language)
        self.check_parent_references(language)
        self.check_code_associations(language)
        self.check_table_associations(language)
        self.collect_statistics(language)

        # Report results
        self.print_report()

        return {
            'issues': self.issues,
            'stats': self.stats
        }

    def check_section_hierarchy(self, language: str = None):
        """Validate section number hierarchy"""
        cursor = self.conn.cursor()

        query = "SELECT section_number, parent_section, depth FROM sections"
        params = []
        if language:
            query += " WHERE language = ?"
            params.append(language)
        query += " ORDER BY section_number"

        cursor.execute(query, params)
        sections = cursor.fetchall()

        for section in sections:
            section_num = section['section_number']
            parent = section['parent_section']
            depth = section['depth']

            # Calculate expected depth from section number
            expected_depth = section_num.count('.')

            if depth != expected_depth:
                self.issues['warning'].append(
                    f"Section {section_num}: depth mismatch (stored={depth}, expected={expected_depth})"
                )

            # Check parent relationship
            if depth > 0:
                # Should have a parent
                parts = section_num.split('.')
                expected_parent = '.'.join(parts[:-1])

                if parent != expected_parent:
                    self.issues['critical'].append(
                        f"Section {section_num}: parent mismatch (stored={parent}, expected={expected_parent})"
                    )
            else:
                # Top-level section should have no parent
                if parent is not None:
                    self.issues['warning'].append(
                        f"Section {section_num}: top-level section has parent={parent}"
                    )

    def check_duplicates(self, language: str = None):
        """Check for duplicate section numbers"""
        cursor = self.conn.cursor()

        query = "SELECT section_number, COUNT(*) as count FROM sections"
        params = []
        if language:
            query += " WHERE language = ?"
            params.append(language)
        query += " GROUP BY section_number HAVING count > 1"

        cursor.execute(query, params)
        duplicates = cursor.fetchall()

        if duplicates:
            for dup in duplicates:
                self.issues['critical'].append(
                    f"Duplicate section number: {dup['section_number']} ({dup['count']} occurrences)"
                )

    def check_page_numbers(self, language: str = None):
        """Validate page number consistency"""
        cursor = self.conn.cursor()

        query = """
            SELECT section_number, page_start, page_end
            FROM sections
        """
        params = []
        if language:
            query += " WHERE language = ?"
            params.append(language)
        query += " ORDER BY page_start"

        cursor.execute(query, params)
        sections = cursor.fetchall()

        for section in sections:
            # Check page range validity
            if section['page_start'] > section['page_end']:
                self.issues['critical'].append(
                    f"Section {section['section_number']}: invalid page range "
                    f"({section['page_start']}-{section['page_end']})"
                )

            # Check for zero or negative pages
            if section['page_start'] <= 0:
                self.issues['critical'].append(
                    f"Section {section['section_number']}: invalid page_start={section['page_start']}"
                )

        # Check for large gaps (might indicate page number estimation issues)
        for i in range(len(sections) - 1):
            curr_end = sections[i]['page_end']
            next_start = sections[i + 1]['page_start']
            gap = next_start - curr_end

            if gap > 50:  # Arbitrary threshold
                self.issues['warning'].append(
                    f"Large page gap ({gap} pages) between sections "
                    f"{sections[i]['section_number']} and {sections[i+1]['section_number']}"
                )

    def check_parent_references(self, language: str = None):
        """Check for orphaned sections (parent doesn't exist)"""
        cursor = self.conn.cursor()

        query = """
            SELECT s1.section_number, s1.parent_section
            FROM sections s1
            WHERE s1.parent_section IS NOT NULL
        """
        params = []
        if language:
            query += " AND s1.language = ?"
            params.append(language)

        cursor.execute(query, params)
        sections_with_parents = cursor.fetchall()

        for section in sections_with_parents:
            # Check if parent exists
            parent_query = "SELECT COUNT(*) as count FROM sections WHERE section_number = ?"
            parent_params = [section['parent_section']]
            if language:
                parent_query += " AND language = ?"
                parent_params.append(language)

            cursor.execute(parent_query, parent_params)
            result = cursor.fetchone()

            if result['count'] == 0:
                self.issues['warning'].append(
                    f"Section {section['section_number']}: parent section "
                    f"{section['parent_section']} not found (orphaned)"
                )

    def check_code_associations(self, language: str = None):
        """Validate code example associations"""
        cursor = self.conn.cursor()

        # Check for code without sections
        query = """
            SELECT COUNT(*) as count FROM code_examples ce
            LEFT JOIN sections s ON ce.section_id = s.id
            WHERE s.id IS NULL
        """
        params = []
        if language:
            query += " AND ce.language = ?"
            params.append(language)

        cursor.execute(query, params)
        orphaned_code = cursor.fetchone()['count']

        if orphaned_code > 0:
            self.issues['critical'].append(
                f"Found {orphaned_code} code examples not associated with any section"
            )

    def check_table_associations(self, language: str = None):
        """Validate table associations"""
        cursor = self.conn.cursor()

        # Check for tables without sections
        query = """
            SELECT COUNT(*) as count FROM tables t
            LEFT JOIN sections s ON t.section_id = s.id
            WHERE s.id IS NULL
        """
        params = []
        if language:
            query += " AND t.language = ?"
            params.append(language)

        cursor.execute(query, params)
        orphaned_tables = cursor.fetchone()['count']

        if orphaned_tables > 0:
            self.issues['critical'].append(
                f"Found {orphaned_tables} tables not associated with any section"
            )

    def collect_statistics(self, language: str = None):
        """Collect overall statistics"""
        cursor = self.conn.cursor()

        # Count sections by depth
        query = "SELECT depth, COUNT(*) as count FROM sections"
        params = []
        if language:
            query += " WHERE language = ?"
            params.append(language)
        query += " GROUP BY depth ORDER BY depth"

        cursor.execute(query, params)
        depth_counts = {row['depth']: row['count'] for row in cursor.fetchall()}

        # Count total items
        queries = {
            'sections': "SELECT COUNT(*) as count FROM sections",
            'code_examples': "SELECT COUNT(*) as count FROM code_examples",
            'tables': "SELECT COUNT(*) as count FROM tables"
        }

        counts = {}
        for name, query in queries.items():
            params = []
            if language:
                query += " WHERE language = ?"
                params.append(language)
            cursor.execute(query, params)
            counts[name] = cursor.fetchone()['count']

        # Calculate percentages
        if counts['sections'] > 0:
            code_coverage = (counts['code_examples'] / counts['sections']) * 100
            table_coverage = (counts['tables'] / counts['sections']) * 100
        else:
            code_coverage = 0
            table_coverage = 0

        self.stats = {
            'total_sections': counts['sections'],
            'total_code': counts['code_examples'],
            'total_tables': counts['tables'],
            'sections_by_depth': depth_counts,
            'code_coverage_pct': code_coverage,
            'table_coverage_pct': table_coverage,
            'avg_code_per_section': counts['code_examples'] / counts['sections'] if counts['sections'] > 0 else 0,
            'avg_tables_per_section': counts['tables'] / counts['sections'] if counts['sections'] > 0 else 0
        }

    def print_report(self):
        """Print validation report"""
        print("\n" + "=" * 70)
        print("VALIDATION RESULTS")
        print("=" * 70)

        # Statistics
        print("\nStatistics:")
        print(f"  Total Sections:     {self.stats['total_sections']}")
        print(f"  Code Examples:      {self.stats['total_code']}")
        print(f"  Tables:             {self.stats['total_tables']}")
        print(f"\n  Code Coverage:      {self.stats['code_coverage_pct']:.1f}% of sections have code")
        print(f"  Table Coverage:     {self.stats['table_coverage_pct']:.1f}% of sections have tables")
        print(f"\n  Avg Code/Section:   {self.stats['avg_code_per_section']:.2f}")
        print(f"  Avg Tables/Section: {self.stats['avg_tables_per_section']:.2f}")

        print("\n  Sections by Depth:")
        for depth, count in sorted(self.stats['sections_by_depth'].items()):
            print(f"    Depth {depth}: {count} sections")

        # Issues summary
        print("\n" + "-" * 70)
        print("Issues Found:")
        print("-" * 70)

        total_issues = sum(len(issues) for issues in self.issues.values())

        if total_issues == 0:
            print("  ✓ No issues found!")
        else:
            print(f"\n  Critical: {len(self.issues['critical'])}")
            print(f"  Warnings: {len(self.issues['warning'])}")
            print(f"  Info:     {len(self.issues['info'])}")

            # Print critical issues
            if self.issues['critical']:
                print("\n  CRITICAL ISSUES:")
                for issue in self.issues['critical'][:10]:  # Limit to first 10
                    print(f"    ✗ {issue}")
                if len(self.issues['critical']) > 10:
                    print(f"    ... and {len(self.issues['critical']) - 10} more")

            # Print warnings
            if self.issues['warning']:
                print("\n  WARNINGS:")
                for issue in self.issues['warning'][:10]:  # Limit to first 10
                    print(f"    ⚠ {issue}")
                if len(self.issues['warning']) > 10:
                    print(f"    ... and {len(self.issues['warning']) - 10} more")

        print("\n" + "=" * 70)

        # Return code based on issues
        if self.issues['critical']:
            print("Status: FAILED (critical issues found)")
            return 1
        elif self.issues['warning']:
            print("Status: PASSED with warnings")
            return 0
        else:
            print("Status: PASSED")
            return 0


def main():
    parser = argparse.ArgumentParser(
        description='Validate extracted LRM data quality'
    )
    parser.add_argument(
        '--db',
        default='data/hdl-lrm.db',
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--language',
        choices=['verilog', 'systemverilog', 'vhdl'],
        help='Validate specific language only'
    )

    args = parser.parse_args()

    validator = ExtractionValidator(args.db)
    validator.validate_all(args.language)


if __name__ == '__main__':
    main()
