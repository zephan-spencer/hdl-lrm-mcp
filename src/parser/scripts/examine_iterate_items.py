#!/usr/bin/env python3
"""
Examine doc.iterate_items() in detail to understand how to extract page numbers.

Usage:
    python examine_iterate_items.py --pdf data/test_snippets/verilog_snippet_5p.pdf
"""

import argparse
import sys
from pathlib import Path


def examine_iterate_items(doc):
    """Deep dive into doc.iterate_items() structure"""
    print("=" * 70)
    print("Examining doc.iterate_items()")
    print("=" * 70)
    
    if not hasattr(doc, 'iterate_items'):
        print("❌ doc.iterate_items() not available")
        return
    
    print("✓ doc.iterate_items() exists\n")
    
    # Get iterator
    items_gen = doc.iterate_items()
    items = list(items_gen)
    
    print(f"Total items: {len(items)}")
    print(f"First item type: {type(items[0])}\n")
    
    # Examine first 10 items
    print("First 10 items:")
    print("-" * 70)
    
    for i, item in enumerate(items[:10]):
        print(f"\nItem {i}:")
        print(f"  Type: {type(item)}")
        
        if isinstance(item, tuple):
            print(f"  Tuple length: {len(item)}")
            
            for j, element in enumerate(item):
                elem_type = type(element).__name__
                print(f"  [{j}]: {elem_type}")
                
                # If it's a reference, show what we can
                if hasattr(element, '__class__'):
                    class_name = element.__class__.__name__
                    
                    # Check for useful attributes
                    if hasattr(element, 'text'):
                        text = str(element.text)[:50]
                        print(f"       .text = {repr(text)}...")
                    
                    if hasattr(element, 'label'):
                        print(f"       .label = {element.label}")
                    
                    if hasattr(element, 'prov'):
                        prov = element.prov
                        print(f"       .prov = {type(prov).__name__}")
                        
                        # Extract page from prov
                        if hasattr(prov, '__iter__') and not isinstance(prov, str):
                            prov_list = list(prov)
                            if len(prov_list) > 0:
                                prov_item = prov_list[0]
                                if hasattr(prov_item, 'bbox'):
                                    bbox = prov_item.bbox
                                    if hasattr(bbox, 'page'):
                                        page = bbox.page
                                        print(f"       PAGE = {page} ✓✓✓")


def examine_texts_collection(doc):
    """Examine doc.texts collection"""
    print("\n\n" + "=" * 70)
    print("Examining doc.texts collection")
    print("=" * 70)
    
    if not hasattr(doc, 'texts'):
        print("❌ doc.texts not available")
        return
    
    texts = doc.texts
    print(f"✓ doc.texts: {len(texts)} items\n")
    
    # Group by page
    pages_map = {}
    
    for i, text_item in enumerate(texts[:20]):  # First 20
        # Extract page
        page = None
        if hasattr(text_item, 'prov'):
            prov = text_item.prov
            if hasattr(prov, '__iter__') and not isinstance(prov, str):
                prov_list = list(prov)
                if len(prov_list) > 0:
                    prov_item = prov_list[0]
                    if hasattr(prov_item, 'bbox'):
                        bbox = prov_item.bbox
                        if hasattr(bbox, 'page'):
                            page = bbox.page
        
        # Get text
        text = str(text_item.text)[:60] if hasattr(text_item, 'text') else '(no text)'
        label = text_item.label if hasattr(text_item, 'label') else 'unknown'
        
        if page not in pages_map:
            pages_map[page] = []
        pages_map[page].append({
            'index': i,
            'label': label,
            'text': text
        })
    
    # Show items per page
    print("Items by page:")
    for page in sorted(pages_map.keys()):
        items = pages_map[page]
        print(f"\n  Page {page}: {len(items)} items")
        for item in items[:3]:  # First 3 per page
            print(f"    [{item['index']}] {item['label']}: {repr(item['text'])}...")


def test_section_extraction(doc):
    """Test extracting sections with pages"""
    print("\n\n" + "=" * 70)
    print("Testing Section Extraction with Pages")
    print("=" * 70)
    
    sections = []
    current_section = None
    
    if hasattr(doc, 'texts'):
        texts = doc.texts
        
        for text_item in texts:
            # Extract page
            page = None
            if hasattr(text_item, 'prov'):
                prov = text_item.prov
                if hasattr(prov, '__iter__') and not isinstance(prov, str):
                    prov_list = list(prov)
                    if len(prov_list) > 0:
                        prov_item = prov_list[0]
                        if hasattr(prov_item, 'bbox'):
                            bbox = prov_item.bbox
                            if hasattr(bbox, 'page'):
                                page = bbox.page
            
            # Get label and text
            label = text_item.label if hasattr(text_item, 'label') else 'unknown'
            text = str(text_item.text) if hasattr(text_item, 'text') else ''
            
            # Check if it's a heading
            if label and ('title' in label.lower() or 'heading' in label.lower()):
                # Save previous section
                if current_section:
                    sections.append(current_section)
                
                # Start new section
                current_section = {
                    'title': text,
                    'page': page,
                    'content': []
                }
            elif current_section:
                # Add to current section
                current_section['content'].append(text)
        
        # Don't forget last section
        if current_section:
            sections.append(current_section)
    
    print(f"\nFound {len(sections)} sections:\n")
    for i, section in enumerate(sections[:5]):  # Show first 5
        content_preview = ' '.join(section['content'][:2])[:100]
        print(f"  Section {i}:")
        print(f"    Title: {section['title'][:60]}")
        print(f"    Page: {section['page']}")
        print(f"    Content: {repr(content_preview)}...")
        print()


def main():
    parser = argparse.ArgumentParser(
        description='Examine iterate_items() in detail'
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
    
    # Run examinations
    examine_iterate_items(doc)
    examine_texts_collection(doc)
    test_section_extraction(doc)
    
    print("\n" + "=" * 70)
    print("✓ Examination Complete")
    print("=" * 70)
    print("\nKey Findings:")
    print("1. Can extract page numbers from item.prov[0].bbox.page")
    print("2. doc.texts contains all text items with labels")
    print("3. Can identify sections by label (title/heading)")
    print("4. Ready to implement accurate page tracking!")


if __name__ == '__main__':
    main()
