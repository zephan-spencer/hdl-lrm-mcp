#!/usr/bin/env python3
"""
Clear embeddings from the database for a specific model.

This script removes embeddings for a specified model, optionally filtered by language.
Useful when upgrading embedding models or regenerating embeddings with different parameters.

Usage:
    python clear_embeddings.py --model Qwen/Qwen3-Embedding-0.6B
    python clear_embeddings.py --model Qwen/Qwen3-Embedding-0.6B --language verilog
    python clear_embeddings.py --all  # Clear all embeddings
"""

import argparse
import sqlite3
from pathlib import Path


def clear_embeddings(db_path: str, model_name: str = None, language: str = None, clear_all: bool = False):
    """
    Clear embeddings from database.

    Args:
        db_path: Path to SQLite database
        model_name: Model name to filter by (e.g., 'Qwen/Qwen3-Embedding-0.6B')
        language: Optional language filter ('verilog', 'systemverilog', or 'vhdl')
        clear_all: If True, clear all embeddings regardless of model
    """
    db = Path(db_path)
    if not db.exists():
        print(f"Error: Database not found at {db_path}")
        return 1

    conn = sqlite3.connect(str(db))
    cursor = conn.cursor()

    # Get stats before deletion
    if clear_all:
        cursor.execute("SELECT COUNT(*) FROM section_embeddings")
    elif language:
        cursor.execute(
            "SELECT COUNT(*) FROM section_embeddings WHERE embedding_model = ? AND language = ?",
            (model_name, language)
        )
    else:
        cursor.execute(
            "SELECT COUNT(*) FROM section_embeddings WHERE embedding_model = ?",
            (model_name,)
        )

    count_before = cursor.fetchone()[0]

    if count_before == 0:
        if clear_all:
            print("No embeddings found in database.")
        elif language:
            print(f"No embeddings found for model '{model_name}' and language '{language}'.")
        else:
            print(f"No embeddings found for model '{model_name}'.")
        conn.close()
        return 0

    # Confirm deletion
    if clear_all:
        print(f"WARNING: This will delete ALL {count_before} embeddings from the database.")
    elif language:
        print(f"This will delete {count_before} embeddings for model '{model_name}' and language '{language}'.")
    else:
        print(f"This will delete {count_before} embeddings for model '{model_name}'.")

    response = input("Continue? [y/N]: ")
    if response.lower() != 'y':
        print("Cancelled.")
        conn.close()
        return 0

    # Delete embeddings
    if clear_all:
        cursor.execute("DELETE FROM section_embeddings")
    elif language:
        cursor.execute(
            "DELETE FROM section_embeddings WHERE embedding_model = ? AND language = ?",
            (model_name, language)
        )
    else:
        cursor.execute(
            "DELETE FROM section_embeddings WHERE embedding_model = ?",
            (model_name,)
        )

    conn.commit()

    # Verify deletion
    cursor.execute("SELECT COUNT(*) FROM section_embeddings")
    count_after = cursor.fetchone()[0]
    deleted = count_before - count_after

    print(f"\n✓ Deleted {deleted} embeddings")
    print(f"  Remaining embeddings in database: {count_after}")

    conn.close()
    return 0


def main():
    parser = argparse.ArgumentParser(
        description='Clear embeddings from the database'
    )
    parser.add_argument(
        '--db',
        default='data/hdl-lrm.db',
        help='Path to SQLite database (default: data/hdl-lrm.db)'
    )
    parser.add_argument(
        '--model',
        help='Model name to clear (e.g., Qwen/Qwen3-Embedding-0.6B)'
    )
    parser.add_argument(
        '--language',
        choices=['verilog', 'systemverilog', 'vhdl'],
        help='Only clear embeddings for this language'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Clear ALL embeddings (ignores --model and --language)'
    )

    args = parser.parse_args()

    # Validation
    if not args.all and not args.model:
        parser.error("Either --model or --all must be specified")

    if args.all and (args.model or args.language):
        parser.error("--all cannot be used with --model or --language")

    return clear_embeddings(args.db, args.model, args.language, args.all)


if __name__ == '__main__':
    exit(main())
