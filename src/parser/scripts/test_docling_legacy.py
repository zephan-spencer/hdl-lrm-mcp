#!/usr/bin/env python3
"""
Test script to verify Docling v2.54.0 API
"""

import sys
import io

# Fix Windows console encoding issues
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

print("Testing Docling v2.54.0 API...")
print("-" * 60)

# Test 1: Import docling
print("\n1. Testing import...")
try:
    import docling
    try:
        version = docling.__version__
    except AttributeError:
        # Try getting version from package metadata
        try:
            from importlib.metadata import version as get_version
            version = get_version('docling')
        except:
            version = "unknown"
    print(f"   ✓ Docling version: {version}")
except ImportError as e:
    print(f"   ✗ Failed to import docling: {e}")
    sys.exit(1)

# Test 2: Import DocumentConverter
print("\n2. Testing DocumentConverter import...")
try:
    from docling.document_converter import DocumentConverter
    print("   ✓ DocumentConverter imported")
except ImportError as e:
    print(f"   ✗ Failed to import DocumentConverter: {e}")
    sys.exit(1)

# Test 3: Check available options
print("\n3. Checking pipeline options...")
try:
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    print("   ✓ PdfPipelineOptions imported")

    # Inspect available options
    options = PdfPipelineOptions()
    print(f"   Available attributes:")
    for attr in dir(options):
        if not attr.startswith('_'):
            value = getattr(options, attr)
            if not callable(value):
                print(f"     - {attr}: {value}")
except ImportError as e:
    print(f"   ✗ Failed to import PdfPipelineOptions: {e}")
except Exception as e:
    print(f"   ⚠ Error inspecting options: {e}")

# Test 4: Check InputFormat
print("\n4. Checking InputFormat...")
try:
    from docling.datamodel.base_models import InputFormat
    print("   ✓ InputFormat imported")
    print(f"   Available formats: {[f.name for f in InputFormat]}")
except ImportError as e:
    print(f"   ✗ Failed to import InputFormat: {e}")

# Test 5: Create converter instance
print("\n5. Testing DocumentConverter instantiation...")
try:
    converter = DocumentConverter()
    print("   ✓ DocumentConverter created")
except Exception as e:
    print(f"   ✗ Failed to create DocumentConverter: {e}")

# Test 6: Check result structure
print("\n6. Checking document structure...")
try:
    from docling.datamodel.document import ConversionResult
    print("   ✓ ConversionResult imported")
    print(f"   Available attributes:")
    for attr in dir(ConversionResult):
        if not attr.startswith('_') and not callable(getattr(ConversionResult, attr)):
            print(f"     - {attr}")
except ImportError as e:
    print(f"   ✗ Failed to import ConversionResult: {e}")
except Exception as e:
    print(f"   ⚠ Error inspecting ConversionResult: {e}")

print("\n" + "=" * 60)
print("✓ Docling API test complete")
print("=" * 60)