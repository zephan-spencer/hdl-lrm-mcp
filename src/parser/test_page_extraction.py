#!/usr/bin/env python3
"""
Test different approaches for extracting page numbers from Docling documents.

This script tries multiple methods to find a working approach for accurate page tracking.

Usage:
    python test_page_extraction.py --pdf data/test_snippets/verilog_snippet_5p.pdf
"""

import argparse
import sys
from pathlib import Path


def test_approach_1_pages_dict(doc):
    """Approach 1: Iterate through doc.pages dict"""
    print("\n" + "=" * 70)
    print("APPROACH 1: Iterate doc.pages dict")
    print("=" * 70)
    
    if not hasattr(doc, 'pages'):
        print("❌ doc.pages not available")
        return False
    
    pages = doc.pages
    print(f"✓ doc.pages exists: {type(pages).__name__}")
    print(f"  Type: {type(pages)}")
    print(f"  Keys: {list(pages.keys()) if isinstance(pages, dict) else 'N/A'}")
    
    if isinstance(pages, dict):
        # Try accessing page objects
        for page_num in sorted(pages.keys())[:2]:
            print(f"\n  Page {page_num}:")
            page_obj = pages[page_num]
            print(f"    Type: {type(page_obj).__name__}")
            print(f"    Value: {page_obj}")
            
            # If it's an object, try to find items
            if hasattr(page_obj, '__dict__'):
                attrs = [a for a in dir(page_obj) if not a.startswith('_')]
                print(f"    Attributes: {attrs[:10]}")
        
        return True
    
    return False


def test_approach_2_iterate_items(doc):
    """Approach 2: Try doc.iterate_items() or similar methods"""
    print("\n" + "=" * 70)
    print("APPROACH 2: Try iteration methods")
    print("=" * 70)
    
    # Try different iteration methods
    methods = ['iterate_items', 'items', 'iter_items', 'get_items', 'all_items']
    
    for method_name in methods:
        if hasattr(doc, method_name):
            print(f"\n✓ Found: doc.{method_name}()")
            try:
                method = getattr(doc, method_name)
                if callable(method):
                    result = method()
                    print(f"  Returns: {type(result).__name__}")
                    
                    # Try to iterate
                    if hasattr(result, '__iter__'):
                        items = list(result)[:3]
                        print(f"  First {len(items)} items:")
                        for i, item in enumerate(items):
                            print(f"    {i}: {type(item).__name__}")
                            if hasattr(item, 'prov'):
                                print(f"       Has prov attribute")
                        return True
                else:
                    print(f"  Not callable")
            except Exception as e:
                print(f"  Error: {e}")
    
    print("\n❌ No iteration methods found")
    return False


def test_approach_3_export_with_metadata(doc):
    """Approach 3: Check export methods for metadata"""
    print("\n" + "=" * 70)
    print("APPROACH 3: Export with metadata")
    print("=" * 70)
    
    # Try different export methods
    export_methods = [
        'export_to_markdown',
        'export_to_dict',
        'export_to_json',
        'to_dict',
        'to_json'
    ]
    
    for method_name in export_methods:
        if hasattr(doc, method_name):
            print(f"\n✓ Found: doc.{method_name}()")
            try:
                method = getattr(doc, method_name)
                if callable(method):
                    result = method()
                    result_type = type(result).__name__
                    
                    if isinstance(result, str):
                        print(f"  Returns: string ({len(result)} chars)")
                        # Check for page markers
                        if 'page' in result.lower()[:1000]:
                            print(f"  ✓ Contains 'page' keyword in first 1000 chars")
                    elif isinstance(result, dict):
                        print(f"  Returns: dict with {len(result)} keys")
                        print(f"  Keys: {list(result.keys())[:10]}")
                    else:
                        print(f"  Returns: {result_type}")
            except Exception as e:
                print(f"  Error: {e}")
    
    return False


def test_approach_4_body_traversal(doc):
    """Approach 4: Traverse doc.body tree and extract provenance"""
    print("\n" + "=" * 70)
    print("APPROACH 4: Traverse body tree with provenance")
    print("=" * 70)
    
    if not hasattr(doc, 'body'):
        print("❌ doc.body not available")
        return False
    
    print(f"✓ doc.body exists: {type(doc.body).__name__}")
    
    if not hasattr(doc.body, 'children'):
        print("❌ doc.body.children not available")
        return False
    
    children = doc.body.children
    print(f"✓ doc.body.children: {len(children)} items")
    
    # Try to access actual items through the document's internal storage
    if hasattr(doc, 'furniture') or hasattr(doc, 'texts') or hasattr(doc, 'tables'):
        print("\nDocument has content collections:")
        for attr in ['furniture', 'texts', 'tables', 'pictures']:
            if hasattr(doc, attr):
                collection = getattr(doc, attr)
                print(f"  doc.{attr}: {type(collection).__name__}")
                if hasattr(collection, '__len__'):
                    print(f"    Length: {len(collection)}")
                    
                    # Inspect first item
                    if len(collection) > 0:
                        if isinstance(collection, dict):
                            first_key = list(collection.keys())[0]
                            first_item = collection[first_key]
                        else:
                            first_item = collection[0]
                        
                        print(f"    First item type: {type(first_item).__name__}")
                        
                        # Check for prov
                        if hasattr(first_item, 'prov'):
                            prov = first_item.prov
                            print(f"    ✓ Has prov: {type(prov).__name__}")
                            
                            # Try to extract page
                            if hasattr(prov, '__iter__') and not isinstance(prov, str):
                                prov_list = list(prov)
                                if len(prov_list) > 0:
                                    prov_item = prov_list[0]
                                    print(f"      prov[0]: {type(prov_item).__name__}")
                                    
                                    if hasattr(prov_item, 'bbox'):
                                        bbox = prov_item.bbox
                                        print(f"        bbox: {type(bbox).__name__}")
                                        
                                        if hasattr(bbox, 'page'):
                                            page = bbox.page
                                            print(f"        ✓✓✓ FOUND PAGE: {page}")
                                            return True
        
        return True
    
    return False


def test_approach_5_doc_tree(doc):
    """Approach 5: Use DoclingDocument tree structure"""
    print("\n" + "=" * 70)
    print("APPROACH 5: DoclingDocument tree traversal")
    print("=" * 70)
    
    # Check available attributes
    doc_attrs = [a for a in dir(doc) if not a.startswith('_') and not callable(getattr(doc, a, None))]
    print(f"Document attributes (non-callable): {len(doc_attrs)}")
    
    interesting_attrs = []
    for attr in doc_attrs:
        try:
            value = getattr(doc, attr)
            val_type = type(value).__name__
            
            # Look for collections that might contain items
            if hasattr(value, '__len__') and val_type not in ['str', 'int', 'float']:
                length = len(value) if hasattr(value, '__len__') else '?'
                interesting_attrs.append(f"{attr}: {val_type}[{length}]")
        except:
            pass
    
    if interesting_attrs:
        print("\nInteresting collections:")
        for attr_info in interesting_attrs[:15]:
            print(f"  {attr_info}")
        return True
    
    return False


def main():
    parser = argparse.ArgumentParser(
        description='Test different page extraction approaches'
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
    
    print("=" * 70)
    print("Testing Page Extraction Approaches")
    print("=" * 70)
    print(f"PDF: {pdf_path}\n")
    
    # Convert document
    print("Converting document...")
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    doc = result.document if hasattr(result, 'document') else result.legacy_document
    print(f"✓ Converted: {type(doc).__name__}\n")
    
    # Test all approaches
    results = {
        'Approach 1 (pages dict)': test_approach_1_pages_dict(doc),
        'Approach 2 (iterate methods)': test_approach_2_iterate_items(doc),
        'Approach 3 (export methods)': test_approach_3_export_with_metadata(doc),
        'Approach 4 (body traversal)': test_approach_4_body_traversal(doc),
        'Approach 5 (doc tree)': test_approach_5_doc_tree(doc)
    }
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    for approach, success in results.items():
        status = "✓ Found working method" if success else "✗ No solution"
        print(f"{approach}: {status}")
    
    successful = [a for a, s in results.items() if s]
    if successful:
        print(f"\n✓ {len(successful)} approach(es) show promise")
        print("Recommended: Use the first successful approach for implementation")
    else:
        print("\n⚠ No clear solution found - may need to review Docling documentation")


if __name__ == '__main__':
    main()
