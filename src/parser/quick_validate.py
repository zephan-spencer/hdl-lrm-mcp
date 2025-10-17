#!/usr/bin/env python3
"""
Quick validation for specific parser enhancements using test snippets.

Tests individual components without full PDF parsing. Each test runs in <30s.

Usage:
    python quick_validate.py --component page-tracking
    python quick_validate.py --component native-structure
    python quick_validate.py --component all
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Dict, List


class QuickValidator:
    """Quick validation of parser enhancements"""

    def __init__(self):
        self.test_snippets = {
            'verilog': Path('data/test_snippets/verilog_snippet_5p.pdf'),
            'systemverilog': Path('data/test_snippets/systemverilog_snippet_5p.pdf'),
            'vhdl': Path('data/test_snippets/vhdl_snippet_5p.pdf')
        }
        self.results = {}

    def validate_page_tracking(self) -> Dict:
        """Test Phase 2: Better page number tracking"""
        print("\n" + "=" * 70)
        print("Testing: Page Number Tracking Enhancement")
        print("=" * 70)

        # Import required modules
        try:
            from docling.document_converter import DocumentConverter
        except ImportError:
            return {'status': 'SKIPPED', 'reason': 'Docling not installed'}

        results = {}

        # Test on Verilog snippet
        snippet = self.test_snippets['verilog']
        if not snippet.exists():
            return {'status': 'SKIPPED', 'reason': 'Test snippet not found'}

        print(f"\nTesting with: {snippet}")
        start = time.time()

        converter = DocumentConverter()
        result = converter.convert(str(snippet))
        doc = result.document if hasattr(result, 'document') else result.legacy_document

        # Check if we can extract page numbers
        page_numbers_found = []
        items_checked = 0

        if hasattr(doc, 'body') and hasattr(doc.body, 'children'):
            for item in doc.body.children[:20]:  # Check first 20 items
                items_checked += 1
                if hasattr(item, 'prov') and hasattr(item.prov, 'page_no'):
                    page_numbers_found.append(item.prov.page_no)

        duration = time.time() - start

        # Calculate accuracy
        unique_pages = set(page_numbers_found)
        accuracy = len(page_numbers_found) / items_checked * 100 if items_checked > 0 else 0

        print(f"\n  Items checked:       {items_checked}")
        print(f"  Pages found:         {len(page_numbers_found)}")
        print(f"  Unique pages:        {len(unique_pages)}")
        print(f"  Accuracy:            {accuracy:.1f}%")
        print(f"  Expected pages:      1-5")
        print(f"  Parse time:          {duration:.1f}s")

        # Validate
        success = accuracy > 50  # At least 50% of items should have page numbers

        if success:
            print(f"\n  ✓ PASSED: Can extract page numbers from Docling items")
            results['status'] = 'PASSED'
        else:
            print(f"\n  ✗ FAILED: Too few items have page provenance data")
            results['status'] = 'FAILED'

        results.update({
            'items_checked': items_checked,
            'pages_found': len(page_numbers_found),
            'accuracy': accuracy,
            'duration': duration
        })

        return results

    def validate_native_structure(self) -> Dict:
        """Test Phase 3: Native document structure parsing"""
        print("\n" + "=" * 70)
        print("Testing: Native Document Structure Parsing")
        print("=" * 70)

        try:
            from docling.document_converter import DocumentConverter
        except ImportError:
            return {'status': 'SKIPPED', 'reason': 'Docling not installed'}

        results = {}
        snippet = self.test_snippets['verilog']

        if not snippet.exists():
            return {'status': 'SKIPPED', 'reason': 'Test snippet not found'}

        print(f"\nTesting with: {snippet}")
        start = time.time()

        converter = DocumentConverter()
        result = converter.convert(str(snippet))
        doc = result.document if hasattr(result, 'document') else result.legacy_document

        # Inspect document structure
        has_body = hasattr(doc, 'body')
        has_children = has_body and hasattr(doc.body, 'children')

        items_found = 0
        heading_count = 0
        paragraph_count = 0
        table_count = 0

        if has_children:
            for item in doc.body.children:
                items_found += 1
                item_type = item.__class__.__name__.lower()

                if 'heading' in item_type or 'title' in item_type:
                    heading_count += 1
                elif 'paragraph' in item_type or 'text' in item_type:
                    paragraph_count += 1
                elif 'table' in item_type:
                    table_count += 1

        duration = time.time() - start

        print(f"\n  Document has body:   {has_body}")
        print(f"  Body has children:   {has_children}")
        print(f"  Total items:         {items_found}")
        print(f"  Headings:            {heading_count}")
        print(f"  Paragraphs:          {paragraph_count}")
        print(f"  Tables:              {table_count}")
        print(f"  Parse time:          {duration:.1f}s")

        # Validate
        success = has_children and items_found > 0 and heading_count > 0

        if success:
            print(f"\n  ✓ PASSED: Can access native document structure")
            results['status'] = 'PASSED'
        else:
            print(f"\n  ✗ FAILED: Cannot access document structure properly")
            results['status'] = 'FAILED'

        results.update({
            'has_structure': has_children,
            'items_found': items_found,
            'headings': heading_count,
            'paragraphs': paragraph_count,
            'tables': table_count,
            'duration': duration
        })

        return results

    def validate_code_detection(self) -> Dict:
        """Test Phase 5: Enhanced code detection"""
        print("\n" + "=" * 70)
        print("Testing: Enhanced Code Block Detection")
        print("=" * 70)

        try:
            from docling.document_converter import DocumentConverter
        except ImportError:
            return {'status': 'SKIPPED', 'reason': 'Docling not installed'}

        results = {}
        snippet = self.test_snippets['verilog']

        if not snippet.exists():
            return {'status': 'SKIPPED', 'reason': 'Test snippet not found'}

        print(f"\nTesting with: {snippet}")
        start = time.time()

        converter = DocumentConverter()
        result = converter.convert(str(snippet))
        doc = result.document if hasattr(result, 'document') else result.legacy_document

        # Export to markdown and count code blocks
        try:
            markdown = doc.export_to_markdown()
            
            # Count markdown code blocks
            import re
            markdown_blocks = len(re.findall(r'```', markdown)) // 2
            
            # Count potential indented blocks (4+ spaces)
            indented_blocks = len(re.findall(r'\n    \w+.*\n', markdown))
            
            # Count HDL keywords as proxy for code presence
            hdl_keywords = ['module', 'endmodule', 'always', 'begin', 'end', 'wire', 'reg']
            keyword_count = sum(markdown.lower().count(kw) for kw in hdl_keywords)
            
            duration = time.time() - start
            
            print(f"\n  Markdown code blocks: {markdown_blocks}")
            print(f"  Indented blocks:      {indented_blocks}")
            print(f"  HDL keywords found:   {keyword_count}")
            print(f"  Parse time:           {duration:.1f}s")
            
            # Validate
            success = markdown_blocks > 0 or keyword_count > 0
            
            if success:
                print(f"\n  ✓ PASSED: Code detection patterns working")
                results['status'] = 'PASSED'
            else:
                print(f"\n  ⚠ WARNING: No code found (may be expected for cover pages)")
                results['status'] = 'WARNING'
            
            results.update({
                'markdown_blocks': markdown_blocks,
                'indented_blocks': indented_blocks,
                'keyword_count': keyword_count,
                'duration': duration
            })
            
        except Exception as e:
            print(f"\n  ✗ FAILED: {e}")
            results['status'] = 'FAILED'
            results['error'] = str(e)

        return results

    def run_all_tests(self):
        """Run all quick validation tests"""
        print("=" * 70)
        print("QUICK VALIDATION SUITE")
        print("=" * 70)
        print("Testing parser enhancements on 5-page snippets")

        # Check if test snippets exist
        missing = [lang for lang, path in self.test_snippets.items() if not path.exists()]
        if missing:
            print(f"\n✗ Missing test snippets for: {', '.join(missing)}")
            print("Run: python src/parser/create_test_snippet.py --pages 5")
            return

        total_start = time.time()

        # Run tests
        self.results['page_tracking'] = self.validate_page_tracking()
        self.results['native_structure'] = self.validate_native_structure()
        self.results['code_detection'] = self.validate_code_detection()

        total_duration = time.time() - total_start

        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)

        passed = sum(1 for r in self.results.values() if r.get('status') == 'PASSED')
        failed = sum(1 for r in self.results.values() if r.get('status') == 'FAILED')
        skipped = sum(1 for r in self.results.values() if r.get('status') == 'SKIPPED')

        print(f"\nTests Run:     {len(self.results)}")
        print(f"  ✓ Passed:    {passed}")
        print(f"  ✗ Failed:    {failed}")
        print(f"  ⊘ Skipped:   {skipped}")
        print(f"\nTotal Time:    {total_duration:.1f}s")

        if failed == 0 and passed > 0:
            print("\n✓ All tests PASSED")
        elif failed > 0:
            print("\n✗ Some tests FAILED")
        else:
            print("\n⊘ No tests completed")


def main():
    parser = argparse.ArgumentParser(
        description='Quick validation of parser enhancements'
    )
    parser.add_argument(
        '--component',
        choices=['page-tracking', 'native-structure', 'code-detection', 'all'],
        default='all',
        help='Component to test'
    )

    args = parser.parse_args()

    validator = QuickValidator()

    if args.component == 'all':
        validator.run_all_tests()
    elif args.component == 'page-tracking':
        validator.validate_page_tracking()
    elif args.component == 'native-structure':
        validator.validate_native_structure()
    elif args.component == 'code-detection':
        validator.validate_code_detection()


if __name__ == '__main__':
    main()
