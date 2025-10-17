#!/usr/bin/env python3
"""
Create test PDF snippets for fast parser development and testing.

Extracts the first N pages from each LRM PDF to create lightweight
test files that can be parsed in seconds instead of minutes.

Usage:
    python create_test_snippet.py --pages 5
    python create_test_snippet.py --pages 10 --output test_data/
"""

import argparse
import sys
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
except ImportError:
    print("Error: pypdf not installed")
    print("Install with: pip install pypdf")
    sys.exit(1)


class SnippetCreator:
    """Create test PDF snippets from full LRM PDFs"""

    def __init__(self, num_pages: int = 5, output_dir: str = "data/test_snippets"):
        self.num_pages = num_pages
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Default LRM locations
        self.lrm_files = {
            'verilog': Path('data/lrms/LRM_V_2005.pdf'),
            'systemverilog': Path('data/lrms/LRM_SYSV_2017.pdf'),
            'vhdl': Path('data/lrms/LRM_VHDL_2008.pdf')
        }

    def create_snippet(self, language: str, pdf_path: Path) -> Path:
        """Extract first N pages from PDF"""
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        print(f"\nProcessing {language.upper()}...")
        print(f"  Input: {pdf_path}")

        # Read PDF
        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)
        pages_to_extract = min(self.num_pages, total_pages)

        print(f"  Total pages: {total_pages}")
        print(f"  Extracting: {pages_to_extract} pages")

        # Create writer with selected pages
        writer = PdfWriter()
        for i in range(pages_to_extract):
            writer.add_page(reader.pages[i])

        # Save snippet
        output_path = self.output_dir / f"{language}_snippet_{self.num_pages}p.pdf"
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)

        output_size = output_path.stat().st_size / 1024  # KB
        print(f"  Output: {output_path}")
        print(f"  Size: {output_size:.1f} KB")
        print(f"  ✓ Snippet created")

        return output_path

    def create_all_snippets(self) -> dict:
        """Create snippets for all available LRMs"""
        print("=" * 70)
        print("Creating Test PDF Snippets")
        print("=" * 70)
        print(f"Pages per snippet: {self.num_pages}")
        print(f"Output directory: {self.output_dir}")

        results = {}
        for language, pdf_path in self.lrm_files.items():
            if pdf_path.exists():
                try:
                    output_path = self.create_snippet(language, pdf_path)
                    results[language] = output_path
                except Exception as e:
                    print(f"  ✗ Failed: {e}")
                    results[language] = None
            else:
                print(f"\n{language.upper()}: PDF not found, skipping")
                results[language] = None

        # Summary
        print("\n" + "=" * 70)
        print("Summary")
        print("=" * 70)
        successful = [lang for lang, path in results.items() if path is not None]
        print(f"Successfully created: {len(successful)}/{len(self.lrm_files)} snippets")
        for lang in successful:
            print(f"  ✓ {lang}: {results[lang]}")

        if len(successful) < len(self.lrm_files):
            failed = [lang for lang, path in results.items() if path is None]
            print(f"\nFailed: {len(failed)}")
            for lang in failed:
                print(f"  ✗ {lang}")

        return results


def main():
    parser = argparse.ArgumentParser(
        description='Create test PDF snippets from LRM PDFs'
    )
    parser.add_argument(
        '--pages',
        type=int,
        default=5,
        help='Number of pages to extract (default: 5)'
    )
    parser.add_argument(
        '--output',
        default='data/test_snippets',
        help='Output directory for snippets (default: data/test_snippets)'
    )
    parser.add_argument(
        '--language',
        choices=['verilog', 'systemverilog', 'vhdl'],
        help='Create snippet for specific language only (default: all)'
    )

    args = parser.parse_args()

    creator = SnippetCreator(num_pages=args.pages, output_dir=args.output)

    if args.language:
        # Create single snippet
        pdf_path = creator.lrm_files.get(args.language)
        if not pdf_path or not pdf_path.exists():
            print(f"Error: PDF not found for {args.language}")
            sys.exit(1)
        creator.create_snippet(args.language, pdf_path)
    else:
        # Create all snippets
        creator.create_all_snippets()


if __name__ == '__main__':
    main()
