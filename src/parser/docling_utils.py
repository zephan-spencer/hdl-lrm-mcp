#!/usr/bin/env python3
"""
Utility functions for working with Docling document objects.

Provides helper functions for extracting page numbers, text content,
and navigating the Docling document structure.
"""

from typing import Optional, List, Dict, Any


def get_page_number(item) -> Optional[int]:
    """
    Extract page number from a Docling item's provenance.
    
    Args:
        item: A Docling item (TextItem, SectionHeaderItem, etc.)
    
    Returns:
        Page number (1-indexed) or None if not available
    """
    if not hasattr(item, 'prov'):
        return None
    
    prov = item.prov
    if not isinstance(prov, list) or len(prov) == 0:
        return None
    
    prov_item = prov[0]
    if hasattr(prov_item, 'page_no'):
        return prov_item.page_no
    
    return None


def get_item_text(item) -> str:
    """
    Extract text content from a Docling item.
    
    Args:
        item: A Docling item
    
    Returns:
        Text content as string, or empty string if not available
    """
    if hasattr(item, 'text'):
        text = item.text
        return str(text) if text is not None else ''
    return ''


def get_item_label(item) -> str:
    """
    Get the label/type of a Docling item.
    
    Args:
        item: A Docling item
    
    Returns:
        Label string (e.g., 'section_header', 'text', 'title')
    """
    if hasattr(item, 'label'):
        return item.label if item.label else 'unknown'
    return 'unknown'


def is_heading(item) -> bool:
    """
    Check if an item is a heading/title.
    
    Args:
        item: A Docling item
    
    Returns:
        True if item is a heading
    """
    label = get_item_label(item)
    class_name = item.__class__.__name__.lower()
    
    return (
        'header' in label.lower() or
        'title' in label.lower() or
        'heading' in label.lower() or
        'sectionheader' in class_name
    )


def extract_section_number(text: str) -> Optional[str]:
    """
    Extract section number from heading text.
    
    Examples:
        "3.2.1 Lexical Conventions" -> "3.2.1"
        "Section 5.4" -> "5.4"
        "Appendix A" -> None
    
    Args:
        text: Heading text
    
    Returns:
        Section number string or None
    """
    import re
    
    # Pattern for section numbers (e.g., "3.2.1", "1.4")
    pattern = r'^(\d+(?:\.\d+)*)\s+'
    match = re.match(pattern, text.strip())
    
    if match:
        return match.group(1)
    
    return None


def group_items_by_page(items: List[Any]) -> Dict[int, List[Any]]:
    """
    Group document items by page number.
    
    Args:
        items: List of Docling items
    
    Returns:
        Dict mapping page number to list of items on that page
    """
    pages = {}
    
    for item in items:
        page = get_page_number(item)
        if page is None:
            page = 0  # Unknown page
        
        if page not in pages:
            pages[page] = []
        pages[page].append(item)
    
    return pages


def get_heading_level(item) -> int:
    """
    Determine the heading level (1-6) from a heading item.
    
    Uses font size, label, or other heuristics.
    
    Args:
        item: A heading/title item
    
    Returns:
        Heading level (1 = top level, 6 = deepest)
    """
    # For now, use a simple heuristic based on label
    label = get_item_label(item)
    
    if 'section_header' in label:
        # Try to infer from text
        text = get_item_text(item)
        section_num = extract_section_number(text)
        
        if section_num:
            # Count dots to determine depth
            depth = section_num.count('.')
            return min(depth + 1, 6)  # Cap at level 6
    
    # Default to level 2
    return 2
