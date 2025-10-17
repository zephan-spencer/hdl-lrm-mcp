#!/usr/bin/env python3
"""
Initialize a test database with schema.

Usage:
    python init_test_db.py data/test_v2.db
"""

import argparse
import sqlite3
from pathlib import Path


def init_database(db_path: str):
    """Initialize database with schema"""
    db_file = Path(db_path)
    schema_file = Path('src/storage/schema.sql')
    
    if not schema_file.exists():
        print(f"Error: Schema file not found: {schema_file}")
        return False
    
    # Read schema
    with open(schema_file, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    # Create database
    print(f"Initializing database: {db_file}")
    conn = sqlite3.connect(str(db_file))
    
    try:
        conn.executescript(schema_sql)
        conn.commit()
        print("✓ Database initialized successfully")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Initialize test database')
    parser.add_argument('db_path', help='Path to database file')
    
    args = parser.parse_args()
    init_database(args.db_path)


if __name__ == '__main__':
    main()
