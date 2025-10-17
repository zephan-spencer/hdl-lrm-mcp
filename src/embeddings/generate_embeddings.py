#!/usr/bin/env python3
"""
Generate semantic embeddings for HDL LRM sections using sentence-transformers.

This script generates embeddings for all sections in the database that don't
already have embeddings for the specified model. Large sections (>6000 chars)
are automatically chunked with 10% overlap, and chunk embeddings are averaged.

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
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from sentence_transformers import SentenceTransformer
    import torch
    from utils.gpu_utils import (
        detect_device,
        get_gpu_info,
        get_optimal_dtype,
        get_optimal_batch_size,
        print_device_info,
        get_gpu_memory_info,
        clear_gpu_cache
    )
except ImportError as e:
    print(f"Error: Required package not installed: {e}")
    print("Install with: pip install sentence-transformers>=2.2.0 torch")
    print("Or run: npm run setup:gpu")
    sys.exit(1)


def chunk_text(text: str, chunk_size: int = 6000, overlap: int = 600) -> List[str]:
    """
    Split text into overlapping chunks to handle content larger than model context window.

    Args:
        text: Text to chunk
        chunk_size: Maximum characters per chunk (default 6000, safe for 8192 token models)
        overlap: Number of characters to overlap between chunks (default 600, ~10% overlap)

    Returns:
        List of text chunks. If text is smaller than chunk_size, returns [text].
    """
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        # Get chunk from start to start+chunk_size
        end = min(start + chunk_size, len(text))
        chunk = text[start:end]
        chunks.append(chunk)

        # Move start forward by (chunk_size - overlap)
        # This creates overlap between chunks for context continuity
        start += chunk_size - overlap

        # Stop if we've reached the end
        if end == len(text):
            break

    return chunks


class EmbeddingGenerator:
    """Generate and store embeddings for LRM sections"""

    def __init__(self, db_path: str, model_name: str = 'Qwen/Qwen3-Embedding-0.6B', device: Optional[str] = None):
        self.db_path = Path(db_path)
        self.model_name = model_name
        self.model = None
        self.conn = None

        # Auto-detect device or use override
        self.device = device if device else detect_device(verbose=False)
        self.dtype = get_optimal_dtype(self.device)

        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {db_path}")
    
    def load_model(self):
        """Load the sentence transformer model"""
        print(f"Loading model: {self.model_name}...")
        print(f"  Device: {self.device.upper()}")
        print(f"  Precision: {self.dtype}")

        if self.device == 'cuda':
            gpu_info = get_gpu_info()
            print(f"  GPU: {gpu_info['name']} ({gpu_info['memory_gb']:.1f} GB)")

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
    
    def process_sections(self, language: Optional[str] = None, batch_size: Optional[int] = None):
        """Process all sections and generate embeddings"""
        sections = self.get_sections_without_embeddings(language)

        if not sections:
            lang_str = f"for {language}" if language else ""
            print(f"No sections need embeddings {lang_str}")
            return 0

        # Auto-adjust batch size based on device if not specified
        if batch_size is None:
            batch_size = get_optimal_batch_size(32, self.device)

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

            # Show GPU memory before batch (if using GPU)
            if self.device == 'cuda':
                used_before, total_mem = get_gpu_memory_info()

            # Prepare texts for batch encoding with chunking support
            # Track chunks and which section they belong to
            all_chunks = []
            chunk_to_section_map = []  # Maps chunk index to section index in batch

            for section_idx, (section_id, section_num, title, content, lang) in enumerate(batch):
                # Combine title and content for embedding (use full content, no truncation)
                # Qwen3-Embedding-0.6B supports up to 8192 tokens (~6000 chars)
                text = f"{title}\n\n{content}"

                # Chunk text if it's too large
                chunks = chunk_text(text, chunk_size=6000, overlap=600)

                # Add all chunks and track which section they belong to
                for chunk in chunks:
                    all_chunks.append(chunk)
                    chunk_to_section_map.append(section_idx)

            # Generate embeddings for all chunks in batch
            # Use torch.no_grad() to prevent gradient graph building (inference best practice)
            with torch.no_grad():
                # normalize_embeddings=True improves retrieval performance
                chunk_embeddings = self.model.encode(
                    all_chunks,
                    convert_to_numpy=True,
                    show_progress_bar=False,
                    normalize_embeddings=True
                )

            # Group chunks by section and average to get one embedding per section
            section_embeddings = []
            current_section_idx = 0
            chunks_for_current_section = []

            for chunk_idx, section_idx in enumerate(chunk_to_section_map):
                if section_idx != current_section_idx:
                    # New section encountered - average the previous section's chunks
                    avg_embedding = np.mean(chunks_for_current_section, axis=0)
                    section_embeddings.append(avg_embedding)
                    chunks_for_current_section = []
                    current_section_idx = section_idx

                chunks_for_current_section.append(chunk_embeddings[chunk_idx])

            # Don't forget the last section
            if chunks_for_current_section:
                avg_embedding = np.mean(chunks_for_current_section, axis=0)
                section_embeddings.append(avg_embedding)

            # Store embeddings and free memory immediately
            for j, (section_id, section_num, title, content, lang) in enumerate(batch):
                embedding = section_embeddings[j].tolist()
                self.store_embedding(section_id, lang, embedding)
                processed += 1

            # Explicitly delete tensors to free GPU memory immediately
            # Don't rely on Python's garbage collector for GPU memory
            del chunk_embeddings
            del all_chunks
            del section_embeddings

            # Commit batch
            self.conn.commit()

            # Clear GPU cache after every batch to prevent memory buildup
            if self.device == 'cuda':
                clear_gpu_cache()

            batch_duration = time.time() - batch_start
            batch_rate = len(batch) / batch_duration

            # Progress report
            elapsed = time.time() - start_time
            rate = processed / elapsed
            remaining = (total - processed) / rate if rate > 0 else 0

            progress_msg = (f"Progress: {processed}/{total} ({processed/total*100:.1f}%) | "
                           f"Batch: {batch_rate:.1f} sections/s | "
                           f"ETA: {remaining:.0f}s")

            # Add GPU memory info (shows reserved memory including PyTorch cache)
            if self.device == 'cuda':
                used_after, _ = get_gpu_memory_info()
                progress_msg += f" | GPU: {used_after:.1f}GB/{total_mem:.1f}GB"

            print(progress_msg)
        
        total_duration = time.time() - start_time
        avg_rate = processed / total_duration

        print(f"\n✓ Generated {processed} embeddings in {total_duration:.1f}s")
        print(f"  Average rate: {avg_rate:.1f} sections/s")

        # Show GPU speedup estimate
        if self.device == 'cuda':
            # Estimate CPU time would be ~15x slower
            estimated_cpu_time = total_duration * 15
            print(f"  Estimated CPU time: {estimated_cpu_time/60:.1f} minutes (~15x slower)")
            print(f"  GPU speedup: ~{estimated_cpu_time/total_duration:.1f}x faster")

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
    
    def run(self, language: Optional[str] = None, batch_size: Optional[int] = None):
        """Main execution"""
        print("=" * 70)
        print("Athens HDL MCP - Embedding Generator")
        print("=" * 70)

        try:
            # Show device info
            print_device_info()

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
        default=None,
        help='Batch size for encoding (default: 32)'
    )
    parser.add_argument(
        '--device',
        choices=['cpu', 'cuda'],
        default=None,
        help='Force device (default: auto-detect)'
    )

    args = parser.parse_args()

    generator = EmbeddingGenerator(args.db, args.model, device=args.device)
    generator.run(args.language, args.batch_size)


if __name__ == '__main__':
    main()
