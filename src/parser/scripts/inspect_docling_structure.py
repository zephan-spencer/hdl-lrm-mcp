#!/usr/bin/env python3
"""
Diagnostic script to inspect Docling document structure and find page number information.

This helps us understand exactly what attributes are available and where page numbers are stored.

Usage:
    python inspect_docling_structure.py --pdf data/test_snippets/verilog_snippet_5p.pdf
    python inspect_docling_structure.py --pdf data/test_snippets/verilog_snippet_5p.pdf --verbose
"""

import argparse
import sys
from pathlib import Path
from typing import Any
import json


def inspect_object(obj: Any, name: str = "object", depth: int = 0, max_depth: int = 3):
    """Recursively inspect an object's attributes"""
    indent = "  " * depth
    
    if depth > max_depth:
        return
    
    print(f"{indent}{name}: {type(obj).__name__}")
    
    # Get all attributes (excluding private ones)
    attrs = [attr for attr in dir(obj) if not attr.startswith('_')]
    
    for attr in attrs[:15]:  # Limit to first 15 to avoid overwhelming output
        try:
            value = getattr(obj, attr)
            
            # Skip methods
            if callable(value):
                continue
            
            # Print primitive types directly
            if isinstance(value, (str, int, float, bool, type(None))):
                print(f"{indent}  .{attr} = {value}")
            elif isinstance(value, (list, tuple)):
                print(f"{indent}  .{attr} = {type(value).__name__}[{len(value)}]")
                if len(value) > 0 and depth < max_depth - 1:
                    inspect_object(value[0], f"{attr}[0]", depth + 2, max_depth)
            elif isinstance(value, dict):
                print(f"{indent}  .{attr} = dict with {len(value)} keys")
            else:
                print(f"{indent}  .{attr} = {type(value).__name__}")
                if depth < max_depth - 1:
                    inspect_object(value, attr, depth + 2, max_depth)
        except Exception as e:
            print(f"{indent}  .{attr} = <error: {e}>")


def inspect_docling_document(pdf_path: Path, verbose: bool = False):
    """Inspect a Docling document structure in detail"""
    print("=" * 70)
    print("Docling Document Structure Inspector")
    print("=" * 70)
    print(f"PDF: {pdf_path}")
    print()
    
    # Import Docling
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        print("Error: Docling not installed")
        sys.exit(1)
    
    # Convert document
    print("Converting document...")
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    
    # Get document
    doc = result.document if hasattr(result, 'document') else result.legacy_document
    
    print(f"✓ Converted successfully")
    print(f"  Document type: {type(doc).__name__}")
    print()
    
    # Inspect top-level document structure
    print("-" * 70)
    print("TOP-LEVEL DOCUMENT STRUCTURE")
    print("-" * 70)
    
    doc_attrs = [attr for attr in dir(doc) if not attr.startswith('_')]
    for attr in doc_attrs[:20]:
        try:
            value = getattr(doc, attr)
            if callable(value):
                continue
            
            if isinstance(value, (str, int, float, bool, type(None))):
                print(f"  doc.{attr} = {value}")
            elif isinstance(value, (list, tuple)):
                print(f"  doc.{attr} = {type(value).__name__}[{len(value)}]")
            elif isinstance(value, dict):
                print(f"  doc.{attr} = dict with {len(value)} keys")
            else:
                print(f"  doc.{attr} = {type(value).__name__}")
        except Exception as e:
            print(f"  doc.{attr} = <error: {e}>")
    
    # Check for main_text or items collection
    print()
    print("-" * 70)
    print("DOCUMENT ITEMS/CONTENT")
    print("-" * 70)
    
    # Try different ways to access items
    items_source = None
    items = []
    
    if hasattr(doc, 'main_text'):
        items = doc.main_text
        items_source = "doc.main_text"
    elif hasattr(doc, 'items'):
        items = doc.items
        items_source = "doc.items"
    
    if items_source:
        print(f"  Found items via: {items_source}")
        print(f"  Number of items: {len(items) if hasattr(items, '__len__') else 'unknown'}")
        print()
        
        # Inspect first few items
        item_list = list(items)[:5] if hasattr(items, '__iter__') else []
        for i, item in enumerate(item_list):
            print(f"  --- Item {i} from {items_source} ---")
            print(f"  Type: {type(item).__name__}")
            
            # Get item attributes
            for attr in ['text', 'label', 'prov', 'page']:
                if hasattr(item, attr):
                    try:
                        value = getattr(item, attr)
                        if attr == 'text':
                            display = str(value)[:80] + "..." if len(str(value)) > 80 else str(value)
                            print(f"    .{attr} = {repr(display)}")
                        else:
                            print(f"    .{attr} = {value}")
                    except Exception as e:
                        print(f"    .{attr} = <error: {e}>")
            print()
    
    # Inspect body structure
    print()
    print("-" * 70)
    print("BODY STRUCTURE")
    print("-" * 70)
    
    if hasattr(doc, 'body'):
        print(f"  doc.body exists: {type(doc.body).__name__}")
        
        if hasattr(doc.body, 'children'):
            items = doc.body.children
            print(f"  doc.body.children: {len(items)} items")
            print()
            
            # Inspect first few items in detail
            for i, item in enumerate(items[:5]):
                print(f"  --- Item {i} ---")
                print(f"  Type: {type(item).__name__}")
                print(f"  Class: {item.__class__.__name__}")
                
                # If it's a RefItem, try to resolve it
                actual_item = item
                if hasattr(item, 'resolve'):
                    try:
                        actual_item = item.resolve()
                        print(f"  Resolved to: {type(actual_item).__name__}")
                    except:
                        pass
                
                # Check for common attributes
                item_attrs = [attr for attr in dir(actual_item) if not attr.startswith('_')]
                
                for attr in ['text', 'label', 'prov', 'page', 'page_no', 'bbox', 'self_ref', 'name']:
                    if attr in item_attrs:
                        try:
                            value = getattr(actual_item, attr)
                            if attr == 'text' and isinstance(value, str):
                                # Truncate long text
                                display = value[:80] + "..." if len(value) > 80 else value
                                print(f"    .{attr} = {repr(display)}")
                            elif attr == 'prov':
                                print(f"    .{attr} = {type(value).__name__}")
                                # Check if prov is iterable
                                if hasattr(value, '__iter__') and not isinstance(value, str):
                                    print(f"    .prov has {len(list(value))} items")
                                    for j, prov_item in enumerate(list(value)[:2]):
                                        print(f"      prov[{j}]: {type(prov_item).__name__}")
                                        # Check for bbox in prov item
                                        if hasattr(prov_item, 'bbox'):
                                            bbox = prov_item.bbox
                                            print(f"        bbox: {type(bbox).__name__}")
                                            if hasattr(bbox, 'page'):
                                                print(f"          page: {bbox.page}")
                                            bbox_dict = {}
                                            for bbox_attr in ['l', 't', 'r', 'b', 'page']:
                                                if hasattr(bbox, bbox_attr):
                                                    bbox_dict[bbox_attr] = getattr(bbox, bbox_attr)
                                            if bbox_dict:
                                                print(f"          coords: {bbox_dict}")
                            elif attr == 'name':
                                print(f"    .{attr} = {value}")
                            else:
                                print(f"    .{attr} = {value}")
                        except Exception as e:
                            print(f"    .{attr} = <error: {e}>")
                
                print()
        else:
            print("  doc.body has no 'children' attribute")
    else:
        print("  doc has no 'body' attribute")
    
    # Check for pages attribute
    print()
    print("-" * 70)
    print("PAGE INFORMATION")
    print("-" * 70)
    
    if hasattr(doc, 'pages'):
        pages = doc.pages
        print(f"  doc.pages exists: {type(pages).__name__}")
        print(f"  Number of pages: {len(pages) if hasattr(pages, '__len__') else 'unknown'}")
        
        if hasattr(pages, '__iter__'):
            for i, page in enumerate(list(pages)[:3]):
                print(f"\n  Page {i}:")
                print(f"    Type: {type(page).__name__}")
                
                page_attrs = [attr for attr in dir(page) if not attr.startswith('_')]
                for attr in ['page_no', 'size', 'width', 'height', 'items']:
                    if attr in page_attrs:
                        try:
                            value = getattr(page, attr)
                            print(f"    .{attr} = {value}")
                        except Exception as e:
                            print(f"    .{attr} = <error: {e}>")
    else:
        print("  doc has no 'pages' attribute")
    
    # Try markdown export to see page markers
    print()
    print("-" * 70)
    print("MARKDOWN EXPORT SAMPLE")
    print("-" * 70)
    
    try:
        markdown = doc.export_to_markdown()
        print(f"  Length: {len(markdown)} characters")
        print(f"  First 500 chars:")
        print("  " + "-" * 60)
        print("  " + markdown[:500].replace('\n', '\n  '))
        print("  " + "-" * 60)
    except Exception as e:
        print(f"  Error exporting markdown: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='Inspect Docling document structure'
    )
    parser.add_argument(
        '--pdf',
        required=True,
        help='Path to PDF file'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show verbose output'
    )
    
    args = parser.parse_args()
    
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"Error: PDF not found: {pdf_path}")
        sys.exit(1)
    
    inspect_docling_document(pdf_path, args.verbose)


if __name__ == '__main__':
    main()
