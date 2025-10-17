#!/usr/bin/env python3
"""
Test the docling_utils helper functions.

Usage:
    python test_docling_utils.py --pdf data/test_snippets/verilog_snippet_5p.pdf
"""

import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from docling_utils import (
    get_page_number,
    get_item_text,
    get_item_label,
    is_heading,
    extract_section_number,
    group_items_by_page
)


def test_utils(doc):
    """Test utility functions on real document"""
    print("=" * 70)
    print("Testing Docling Utility Functions")
    print("=" * 70)
    
    if not hasattr(doc, 'texts'):
        print("❌ doc.texts not available")
        return
    
    texts = doc.texts
    print(f"✓ Testing on {len(texts)} text items\n")
    
    # Test 1: Page number extraction
    print("1. TESTING get_page_number()")
    print("-" * 70)
    page_counts = {}
    items_with_pages = 0
    
    for item in texts:
        page = get_page_number(item)
        if page is not None:
            items_with_pages += 1
            page_counts[page] = page_counts.get(page, 0) + 1
    
    accuracy = (items_with_pages / len(texts)) * 100
    print(f"Items with page numbers: {items_with_pages}/{len(texts)} ({accuracy:.1f}%)")
    print(f"Pages found: {sorted(page_counts.keys())}")
    print(f"Items per page: {page_counts}")
    
    if accuracy > 95:
        print("✓✓✓ EXCELLENT: >95% accuracy!")
    elif accuracy > 80:
        print("✓ GOOD: >80% accuracy")
    else:
        print("⚠ POOR: <80% accuracy")
    
    # Test 2: Heading detection
    print("\n\n2. TESTING is_heading()")
    print("-" * 70)
    heading_count = 0
    headings_found = []
    
    for item in texts[:20]:  # First 20 items
        if is_heading(item):
            heading_count += 1
            text = get_item_text(item)
            page = get_page_number(item)
            headings_found.append((text[:60], page))
    
    print(f"Headings found in first 20 items: {heading_count}")
    print("\nHeadings:")
    for text, page in headings_found:
        print(f"  [Page {page}] {text}")
    
    # Test 3: Section number extraction
    print("\n\n3. TESTING extract_section_number()")
    print("-" * 70)
    test_cases = [
        "3.2.1 Lexical Conventions",
        "1 Overview",
        "5.4.3.2 Expression Evaluation",
        "Appendix A: Examples",
        "Introduction"
    ]
    
    for test in test_cases:
        section_num = extract_section_number(test)
        print(f"  '{test}' -> {section_num}")
    
    # Test 4: Group by page
    print("\n\n4. TESTING group_items_by_page()")
    print("-" * 70)
    pages_dict = group_items_by_page(texts)
    
    print(f"Total pages with items: {len(pages_dict)}")
    for page in sorted(pages_dict.keys()):
        items = pages_dict[page]
        headings = [i for i in items if is_heading(i)]
        print(f"  Page {page}: {len(items)} items ({len(headings)} headings)")
    
    # Test 5: End-to-end section extraction
    print("\n\n5. END-TO-END SECTION EXTRACTION TEST")
    print("-" * 70)
    
    sections = []
    current_section = None
    
    for item in texts:
        if is_heading(item):
            # Save previous section
            if current_section and current_section['content']:
                sections.append(current_section)
            
            # Start new section
            title = get_item_text(item)
            page = get_page_number(item)
            section_num = extract_section_number(title)
            
            current_section = {
                'number': section_num,
                'title': title,
                'page_start': page,
                'page_end': page,
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
    
    print(f"Extracted {len(sections)} sections:\n")
    for i, section in enumerate(sections[:5]):
        content_len = sum(len(c) for c in section['content'])
        print(f"  Section {i}:")
        print(f"    Number: {section['number']}")
        print(f"    Title: {section['title'][:60]}")
        print(f"    Pages: {section['page_start']}-{section['page_end']}")
        print(f"    Content: {content_len} chars")
        print()
    
    # Validation
    print("\nVALIDATION:")
    sections_with_numbers = [s for s in sections if s['number']]
    sections_with_pages = [s for s in sections if s['page_start']]
    
    print(f"  Sections with numbers: {len(sections_with_numbers)}/{len(sections)}")
    print(f"  Sections with pages: {len(sections_with_pages)}/{len(sections)}")
    
    if len(sections_with_pages) == len(sections):
        print("  ✓✓✓ ALL SECTIONS HAVE PAGE NUMBERS!")
        return True
    else:
        print("  ⚠ Some sections missing page numbers")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Test docling_utils functions'
    )
    parser.add_argument(
        '--pdf',
        required=True,
        help='Path to PDF file'
    )
    
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: PDF not found: {pdf_path}")
        sys.exit(1)
    
    # Import Docling
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        print("Error: Docling not installed")
        sys.exit(1)
    
    # Convert document
    print(f"Converting: {pdf_path}")
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    doc = result.document if hasattr(result, 'document') else result.legacy_document
    print(f"✓ Converted\n")
    
    # Run tests
    success = test_utils(doc)
    
    print("\n" + "=" * 70)
    if success:
        print("✓ ALL TESTS PASSED - Utils are working correctly!")
    else:
        print("⚠ Some tests had issues - check output above")
    print("=" * 70)


if __name__ == '__main__':
    main()
