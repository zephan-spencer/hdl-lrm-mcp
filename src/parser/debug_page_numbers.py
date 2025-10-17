#!/usr/bin/env python3
"""
Debug why page numbers are None in provenance data.

Usage:
    python debug_page_numbers.py --pdf data/test_snippets/verilog_snippet_5p.pdf
"""

import argparse
import sys
from pathlib import Path


def debug_page_numbers(doc):
    """Deep dive into page number extraction"""
    print("=" * 70)
    print("Debugging Page Number Extraction")
    print("=" * 70)
    
    # Method 1: Check doc.pages structure
    print("\n1. CHECKING doc.pages")
    print("-" * 70)
    if hasattr(doc, 'pages'):
        pages = doc.pages
        print(f"doc.pages type: {type(pages)}")
        if isinstance(pages, dict):
            print(f"Page numbers in dict: {sorted(pages.keys())}")
            # Get first page object
            first_page_num = sorted(pages.keys())[0]
            first_page = pages[first_page_num]
            print(f"\nFirst page object (page {first_page_num}):")
            print(f"  Type: {type(first_page).__name__}")
            if hasattr(first_page, 'page_no'):
                print(f"  page_no: {first_page.page_no}")
            if hasattr(first_page, '__dict__'):
                print(f"  Attributes: {list(first_page.__dict__.keys())}")
    
    # Method 2: Check text items for page info
    print("\n\n2. CHECKING doc.texts PROVENANCE")
    print("-" * 70)
    if hasattr(doc, 'texts'):
        texts = doc.texts
        print(f"Total text items: {len(texts)}")
        
        # Check first text item in detail
        if len(texts) > 0:
            for i, text_item in enumerate(texts[:5]):
                print(f"\nText item {i}:")
                print(f"  Type: {type(text_item).__name__}")
                print(f"  Label: {getattr(text_item, 'label', 'N/A')}")
                
                # Check provenance
                if hasattr(text_item, 'prov'):
                    prov = text_item.prov
                    print(f"  Provenance: {type(prov).__name__}")
                    
                    if isinstance(prov, list) and len(prov) > 0:
                        print(f"    Length: {len(prov)}")
                        prov_item = prov[0]
                        print(f"    prov[0] type: {type(prov_item).__name__}")
                        
                        # Check all attributes of prov_item
                        prov_attrs = [a for a in dir(prov_item) if not a.startswith('_')]
                        print(f"    prov[0] attributes: {prov_attrs}")
                        
                        # Check bbox
                        if hasattr(prov_item, 'bbox'):
                            bbox = prov_item.bbox
                            print(f"    bbox type: {type(bbox).__name__}")
                            
                            # Check ALL bbox attributes
                            bbox_attrs = {a: getattr(bbox, a) for a in dir(bbox) if not a.startswith('_') and not callable(getattr(bbox, a))}
                            print(f"    bbox attributes:")
                            for attr, value in bbox_attrs.items():
                                print(f"      {attr}: {value}")
                        
                        # Check other prov_item attributes
                        for attr in ['page', 'page_no', 'page_number']:
                            if hasattr(prov_item, attr):
                                value = getattr(prov_item, attr)
                                print(f"    prov[0].{attr}: {value}")
    
    # Method 3: Try doc.iterate_items()
    print("\n\n3. CHECKING doc.iterate_items()")
    print("-" * 70)
    if hasattr(doc, 'iterate_items'):
        items_gen = doc.iterate_items()
        items = list(items_gen)
        print(f"Total items: {len(items)}")
        
        # Check if items are tuples with page info
        if len(items) > 0:
            first_item = items[0]
            print(f"\nFirst item structure:")
            print(f"  Type: {type(first_item)}")
            
            if isinstance(first_item, tuple):
                print(f"  Tuple length: {len(first_item)}")
                for i, elem in enumerate(first_item):
                    print(f"  [{i}]: {type(elem).__name__} = {elem if not hasattr(elem, '__dict__') else '...'}")
                
                # The second element might be page/level info
                if len(first_item) > 1:
                    print(f"\n  Second tuple element (might be level/page): {first_item[1]}")
    
    # Method 4: Check if page info is in export
    print("\n\n4. CHECKING export_to_dict()")
    print("-" * 70)
    if hasattr(doc, 'export_to_dict'):
        doc_dict = doc.export_to_dict()
        print(f"Dict keys: {list(doc_dict.keys())}")
        
        # Check if texts have page info
        if 'texts' in doc_dict and len(doc_dict['texts']) > 0:
            first_text = doc_dict['texts'][0]
            print(f"\nFirst text in dict:")
            print(f"  Keys: {list(first_text.keys())}")
            if 'prov' in first_text and len(first_text['prov']) > 0:
                first_prov = first_text['prov'][0]
                print(f"  prov[0] keys: {list(first_prov.keys())}")
                if 'bbox' in first_prov:
                    print(f"  bbox: {first_prov['bbox']}")
    
    # Method 5: Map items to pages using bbox coordinates
    print("\n\n5. MAPPING ITEMS TO PAGES USING COORDINATES")
    print("-" * 70)
    if hasattr(doc, 'texts') and hasattr(doc, 'pages'):
        texts = doc.texts
        pages = doc.pages
        
        # Get page dimensions (assume all same)
        if isinstance(pages, dict) and len(pages) > 0:
            first_page = pages[sorted(pages.keys())[0]]
            if hasattr(first_page, 'size'):
                page_height = first_page.size.height
                print(f"Page height: {page_height}")
                
                # Try to infer page from bbox top coordinate
                print("\nAttempting to infer page from bbox coordinates:")
                for i, text_item in enumerate(texts[:5]):
                    if hasattr(text_item, 'prov'):
                        prov = text_item.prov
                        if isinstance(prov, list) and len(prov) > 0:
                            prov_item = prov[0]
                            if hasattr(prov_item, 'bbox'):
                                bbox = prov_item.bbox
                                # Try to get coordinates
                                if hasattr(bbox, 't'):  # top coordinate
                                    top = bbox.t
                                    # Estimate page number
                                    estimated_page = int(top / page_height) + 1
                                    text_preview = str(text_item.text)[:40] if hasattr(text_item, 'text') else ''
                                    print(f"  Item {i}: top={top:.1f} -> estimated page {estimated_page}")
                                    print(f"    Text: {repr(text_preview)}")


def main():
    parser = argparse.ArgumentParser(
        description='Debug page number extraction'
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
    print(f"✓ Converted: {type(doc).__name__}\n")
    
    # Run debug
    debug_page_numbers(doc)
    
    print("\n" + "=" * 70)
    print("Debug complete - check output above for working page extraction method")
    print("=" * 70)


if __name__ == '__main__':
    main()
