#!/usr/bin/env python3
"""
Quick inspection without full parsing - just check API structure
"""

import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat

print("Checking Docling v2.54.0 API structure...\n")

# Create converter
converter = DocumentConverter()

# Check what methods are available on DocumentConverter result
print("1. Checking ConversionResult structure...")
try:
    from docling.datamodel.document import ConversionResult, DoclingDocument

    print(f"   ConversionResult attributes:")
    for attr in dir(ConversionResult):
        if not attr.startswith('_') and not callable(getattr(ConversionResult, attr, None)):
            print(f"     - {attr}")

    print(f"\n   DoclingDocument methods:")
    for attr in dir(DoclingDocument):
        if not attr.startswith('_') and callable(getattr(DoclingDocument, attr, None)):
            print(f"     - {attr}()")

except ImportError as e:
    print(f"   Could not import document classes: {e}")

# Try to understand document iteration
print("\n2. Checking document item types...")
try:
    from docling.datamodel.base_models import BaseText
    from docling.datamodel.document import (
        TextItem, SectionHeaderItem, TableItem, PictureItem
    )

    print("   Available item types:")
    for cls in [TextItem, SectionHeaderItem, TableItem, PictureItem]:
        print(f"     - {cls.__name__}")
        # Show attributes
        sample = cls.__annotations__ if hasattr(cls, '__annotations__') else {}
        if sample:
            print(f"       Attributes: {list(sample.keys())}")

except ImportError as e:
    print(f"   Could not import item types: {e}")

# Check for markdown export
print("\n3. Checking export methods...")
try:
    # Create a dummy document to see export methods
    print("   Looking for export methods in DoclingDocument...")
    from docling.datamodel.document import DoclingDocument

    # Check class for export methods
    for method in ['export_to_markdown', 'export_to_dict', 'export_to_text', 'iterate_items']:
        if hasattr(DoclingDocument, method):
            print(f"   ✓ {method}() exists")
        else:
            print(f"   ✗ {method}() not found")

except Exception as e:
    print(f"   Error checking exports: {e}")

print("\n4. Checking document structure access...")
try:
    from docling.datamodel.document import DoclingDocument

    # Check attributes
    for attr in ['pages', 'body', 'main_text', 'tables', 'pictures']:
        if hasattr(DoclingDocument, attr):
            print(f"   ✓ {attr} attribute exists")
        else:
            print(f"   ✗ {attr} not found")

except Exception as e:
    print(f"   Error: {e}")

# Try to find the actual API documentation approach
print("\n5. Recommended approach (from Docling docs):")
print("""
   Based on Docling v2.54.0 patterns:

   result = converter.convert(pdf_path)
   doc = result.document  # or result.legacy_document

   # For structured access:
   for item in doc.iterate_items():
       if isinstance(item, SectionHeaderItem):
           # This is a heading/section
           print(item.text, item.level)
       elif isinstance(item, TableItem):
           # This is a table
           pass
       elif isinstance(item, TextItem):
           # This is body text
           pass

   # Or for simple text extraction:
   markdown = doc.export_to_markdown()
   plain_text = doc.export_to_text()
""")

print("\n✓ API structure check complete")
print("Next: Update parser to use correct item type checking")