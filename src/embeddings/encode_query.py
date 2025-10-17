#!/usr/bin/env python3
"""
Generate embedding for a single query text.
Called by MCP server to encode search queries.

Usage:
    python encode_query.py "your search query here"
    python encode_query.py "your search query" --model Qwen/Qwen3-Embedding-0.6B
"""

import argparse
import json
import sys

try:
    from sentence_transformers import SentenceTransformer
    import torch
except ImportError:
    print(json.dumps({"error": "sentence-transformers or torch not installed"}))
    sys.exit(1)

# Cache model globally for faster repeated calls
_model_cache = {}

def get_model(model_name: str) -> SentenceTransformer:
    """Get or load model from cache"""
    if model_name not in _model_cache:
        # Detect device (GPU if available, else CPU)
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        
        # Load model with trust_remote_code for Qwen models
        _model_cache[model_name] = SentenceTransformer(
            model_name,
            device=device,
            trust_remote_code=True
        )
    return _model_cache[model_name]

def encode_query(text: str, model_name: str = 'Qwen/Qwen3-Embedding-0.6B') -> list:
    """Encode query text to embedding vector"""
    model = get_model(model_name)
    # normalize_embeddings=True for consistent similarity search
    embedding = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return embedding.tolist()

def main():
    parser = argparse.ArgumentParser(description='Encode query text to embedding')
    parser.add_argument('query', help='Query text to encode')
    parser.add_argument('--model', default='Qwen/Qwen3-Embedding-0.6B', help='Model name')
    
    args = parser.parse_args()
    
    try:
        embedding = encode_query(args.query, args.model)
        
        # Output as JSON for easy parsing by TypeScript
        result = {
            'embedding': embedding,
            'model': args.model,
            'dimension': len(embedding)
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'error': str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
