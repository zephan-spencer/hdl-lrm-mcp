#!/usr/bin/env python3
"""
Generate semantic embeddings for HDL LRM sections using sentence-transformers.

This script generates embeddings for all sections in the database that don't
already have embeddings for the specified model.

Usage:
    python generate_embeddings.py --language verilog
    python generate_embeddings.py --language systemverilog --model Qwen/Qwen3-Embedding-0.6B
    python generate_embeddings.py  # Process all languages
"""

import argparse
import sqlite3
import json
import time
import sys
from pathlib import Path
from typing import List, Tuple, Optional
from datetime import datetime

try:
    from sentence_transformers import SentenceTransformer
    import torch
except ImportError as e:
    print(f"Error: Required package not installed: {e}")
    print("Install with: pip install sentence-transformers>=2.2.0 torch")
    sys.exit(1)


class EmbeddingGenerator:
    """Generate and store embeddings for LRM sections"""

    def __init__(self, db_path: str, model_name: str = 'Qwen/Qwen3-Embedding-0.6B'):
        self.db_path = Path(db_path)
        self.model_name = model_name
        self.model = None
        self.conn = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {db_path}")
    
    def load_model(self):
        """Load the sentence transformer model"""
        print(f"Loading model: {self.model_name}...")
        print(f"  Device: {self.device}")
        start_time = time.time()
        
        # Load model with trust_remote_code for Qwen models
        self.model = SentenceTransformer(
            self.model_name,
            device=self.device,
            trust_remote_code=True
        )
        
        duration = time.time() - start_time
        print(f"✓ Model loaded in {duration:.1f}s")
        print(f"  Embedding dimension: {self.model.get_sentence_embedding_dimension()}")
    
    def connect_db(self):
        """Connect to SQLite database"""
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.execute("PRAGMA foreign_keys = ON")
    
    def close_db(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
    
    def get_sections_without_embeddings(self, language: Optional[str] = None) -> List[Tuple]:
        """Get sections that don't have embeddings yet"""
        cursor = self.conn.cursor()
        
        # Find sections without embeddings for this model
        query = """
            SELECT s.id, s.section_number, s.title, s.content, s.language
            FROM sections s
            LEFT JOIN section_embeddings e 
                ON s.id = e.section_id 
                AND e.embedding_model = ?
            WHERE e.id IS NULL
        """
        params = [self.model_name]
        
        if language:
            query += " AND s.language = ?"
            params.append(language)
        
        query += " ORDER BY s.language, s.section_number"
        
        cursor.execute(query, params)
        return cursor.fetchall()
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a text"""
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    
    def store_embedding(self, section_id: int, language: str, embedding: List[float]):
        """Store embedding in database"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            INSERT INTO section_embeddings 
            (section_id, language, embedding_model, embedding_json, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            section_id,
            language,
            self.model_name,
            json.dumps(embedding),
            int(time.time())
        ))
    
    def process_sections(self, language: Optional[str] = None, batch_size: int = 32):
        """Process all sections and generate embeddings"""
        sections = self.get_sections_without_embeddings(language)
        
        if not sections:
            lang_str = f"for {language}" if language else ""
            print(f"No sections need embeddings {lang_str}")
            return 0
        
        total = len(sections)
        print(f"\nGenerating embeddings for {total} sections...")
        if language:
            print(f"Language: {language}")
        print(f"Model: {self.model_name}")
        print(f"Batch size: {batch_size}\n")
        
        start_time = time.time()
        processed = 0
        
        # Process in batches for efficiency
        for i in range(0, total, batch_size):
            batch = sections[i:i + batch_size]
            batch_start = time.time()
            
            # Prepare texts for batch encoding
            texts = []
            for section_id, section_num, title, content, lang in batch:
                # Combine title and content for embedding
                # Qwen3-Embedding-0.6B supports up to 8192 tokens (~6000 chars)
                # Use more context than the previous all-mpnet-base-v2 model (512 tokens)
                text = f"{title}\n\n{content[:6000]}"
                texts.append(text)
            
            # Generate embeddings in batch
            # normalize_embeddings=True improves retrieval performance
            embeddings = self.model.encode(
                texts, 
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True
            )
            
            # Store embeddings
            for j, (section_id, section_num, title, content, lang) in enumerate(batch):
                embedding = embeddings[j].tolist()
                self.store_embedding(section_id, lang, embedding)
                processed += 1
            
            # Commit batch
            self.conn.commit()
            
            batch_duration = time.time() - batch_start
            batch_rate = len(batch) / batch_duration
            
            # Progress report
            elapsed = time.time() - start_time
            rate = processed / elapsed
            remaining = (total - processed) / rate if rate > 0 else 0
            
            print(f"Progress: {processed}/{total} ({processed/total*100:.1f}%) | "
                  f"Batch: {batch_rate:.1f} sections/s | "
                  f"ETA: {remaining:.0f}s")
        
        total_duration = time.time() - start_time
        avg_rate = processed / total_duration
        
        print(f"\n✓ Generated {processed} embeddings in {total_duration:.1f}s")
        print(f"  Average rate: {avg_rate:.1f} sections/s")
        
        return processed
    
    def get_embedding_stats(self) -> dict:
        """Get statistics about embeddings in database"""
        cursor = self.conn.cursor()
        
        # Total embeddings
        cursor.execute("""
            SELECT COUNT(*) FROM section_embeddings
            WHERE embedding_model = ?
        """, (self.model_name,))
        total = cursor.fetchone()[0]
        
        # By language
        cursor.execute("""
            SELECT language, COUNT(*) as count
            FROM section_embeddings
            WHERE embedding_model = ?
            GROUP BY language
            ORDER BY language
        """, (self.model_name,))
        by_language = dict(cursor.fetchall())
        
        # Total sections (for comparison)
        cursor.execute("SELECT COUNT(*) FROM sections")
        total_sections = cursor.fetchone()[0]
        
        return {
            'total_embeddings': total,
            'total_sections': total_sections,
            'coverage': total / total_sections * 100 if total_sections > 0 else 0,
            'by_language': by_language,
            'model': self.model_name
        }
    
    def run(self, language: Optional[str] = None, batch_size: int = 32):
        """Main execution"""
        print("=" * 70)
        print("Athens HDL MCP - Embedding Generator")
        print("=" * 70)
        
        try:
            # Load model
            self.load_model()
            
            # Connect to database
            print(f"\nConnecting to database: {self.db_path}")
            self.connect_db()
            print("✓ Connected")
            
            # Show current stats
            stats = self.get_embedding_stats()
            print(f"\nCurrent embeddings: {stats['total_embeddings']}/{stats['total_sections']} " 
                  f"({stats['coverage']:.1f}% coverage)")
            if stats['by_language']:
                for lang, count in stats['by_language'].items():
                    print(f"  {lang}: {count}")
            
            # Process sections
            processed = self.process_sections(language, batch_size)
            
            # Show final stats
            if processed > 0:
                stats = self.get_embedding_stats()
                print(f"\nFinal embeddings: {stats['total_embeddings']}/{stats['total_sections']} "
                      f"({stats['coverage']:.1f}% coverage)")
                for lang, count in stats['by_language'].items():
                    print(f"  {lang}: {count}")
            
            print("\n" + "=" * 70)
            print("✓ Embedding Generation Complete")
            print("=" * 70)
            
        except Exception as e:
            print(f"\n✗ Error: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        finally:
            self.close_db()


def main():
    parser = argparse.ArgumentParser(
        description='Generate semantic embeddings for HDL LRM sections'
    )
    parser.add_argument(
        '--db',
        default='data/hdl-lrm.db',
        help='Path to SQLite database'
    )
    parser.add_argument(
        '--language',
        choices=['verilog', 'systemverilog', 'vhdl'],
        help='Process only this language (default: all)'
    )
    parser.add_argument(
        '--model',
        default='Qwen/Qwen3-Embedding-0.6B',
        help='Sentence transformer model to use (default: Qwen/Qwen3-Embedding-0.6B)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=32,
        help='Batch size for encoding (default: 32)'
    )
    
    args = parser.parse_args()
    
    generator = EmbeddingGenerator(args.db, args.model)
    generator.run(args.language, args.batch_size)


if __name__ == '__main__':
    main()
