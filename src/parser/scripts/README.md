# Parser Debug & Utility Scripts

This directory contains debug and development scripts for the HDL LRM parser.
These scripts are not part of the core parser functionality.

## Scripts

### Inspection Tools
- **inspect_docling_structure.py** - Examines Docling document structure for debugging
- **debug_page_numbers.py** - Validates page number extraction accuracy
- **examine_iterate_items.py** - Tests different Docling iteration patterns

### Validation Tools
- **validate_extraction.py** - Validates extracted sections, code, and tables
- **quick_validate.py** - Quick validation script for testing
- **test_page_extraction.py** - Tests page number extraction methods

### Test Data Tools
- **create_test_snippet.py** - Creates small PDF snippets for testing
- **init_test_db.py** - Initializes test databases

### Legacy Code
- **parse_lrm_v1_legacy.py** - Original parser implementation (pre-v2)
- **test_docling_legacy.py** - Legacy Docling API tests
- **quick_inspect_legacy.py** - Legacy inspection script
- **test_docling_utils.py** - Unit tests for docling_utils.py

## Usage

These scripts are standalone utilities. Run them directly:

```bash
# Example: Inspect PDF structure
python src/parser/scripts/inspect_docling_structure.py data/lrms/LRM_V_2005.pdf

# Example: Validate extraction
python src/parser/scripts/validate_extraction.py data/hdl-lrm.db verilog
```

## Core Parser

The main parser is located in the parent directory:
- **../parse_lrm.py** - Production parser (use this!)
- **../docling_utils.py** - Shared utilities
