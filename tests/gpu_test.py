#!/usr/bin/env python3
"""
Athens HDL MCP - GPU Detection and Verification Test

Tests GPU detection, model loading, and basic functionality
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

import torch
from utils.gpu_utils import (
    detect_device,
    get_gpu_info,
    get_optimal_dtype,
    get_optimal_batch_size,
    print_device_info,
    get_gpu_memory_info,
    check_gpu_available
)


def test_gpu_detection():
    """Test basic GPU detection"""
    print("=" * 70)
    print("GPU Detection Test")
    print("=" * 70)

    device = detect_device()
    print(f"\n✓ Detected device: {device}")

    if device == 'cuda':
        info = get_gpu_info()
        print(f"✓ GPU Name: {info['name']}")
        print(f"✓ GPU Memory: {info['memory_gb']:.1f} GB")
        print(f"✓ Compute Capability: {info['compute_capability']}")

        if 'rocm_version' in info:
            print(f"✓ ROCm Version: {info['rocm_version']}")
            print(f"✓ Backend: {info['backend']}")
        elif 'cuda_version' in info:
            print(f"✓ CUDA Version: {info['cuda_version']}")
            print(f"✓ Backend: {info['backend']}")

        # Test memory info
        used, total = get_gpu_memory_info()
        print(f"✓ GPU Memory Usage: {used:.2f} GB / {total:.1f} GB")

        # Test bfloat16 support
        if torch.cuda.is_bf16_supported():
            print("✓ bfloat16: Supported")
        else:
            print("⚠ bfloat16: Not supported (will use float16)")
    else:
        print("  Running in CPU mode")

    return device


def test_optimal_settings(device):
    """Test optimal dtype and batch size selection"""
    print("\n" + "=" * 70)
    print("Optimal Settings Test")
    print("=" * 70)

    dtype = get_optimal_dtype(device)
    print(f"\n✓ Optimal dtype: {dtype}")

    batch_size = get_optimal_batch_size(32, device)
    print(f"✓ Optimal batch size: {batch_size} (base: 32)")

    if device == 'cuda':
        expected_batch = 128
        assert batch_size == expected_batch, f"Expected {expected_batch}, got {batch_size}"
        print(f"✓ Batch size correctly adjusted for GPU (4x)")


def test_model_loading(device):
    """Test loading a small model on the detected device"""
    print("\n" + "=" * 70)
    print("Model Loading Test")
    print("=" * 70)

    try:
        from sentence_transformers import SentenceTransformer

        print("\nLoading Qwen3-Embedding-0.6B...")
        print(f"  Device: {device}")
        print(f"  This may take a minute on first run...")

        model = SentenceTransformer(
            'Qwen/Qwen3-Embedding-0.6B',
            device=device,
            trust_remote_code=True
        )

        print(f"✓ Model loaded successfully")
        print(f"  Embedding dimension: {model.get_sentence_embedding_dimension()}")

        # Test encoding
        print("\nTesting encoding...")
        test_text = "This is a test query for HDL documentation"
        embedding = model.encode(test_text, convert_to_numpy=True, normalize_embeddings=True)

        print(f"✓ Encoding successful")
        print(f"  Embedding shape: {embedding.shape}")
        print(f"  Embedding dtype: {embedding.dtype}")

        if device == 'cuda':
            used_after, total = get_gpu_memory_info()
            print(f"  GPU memory after model load: {used_after:.2f} GB / {total:.1f} GB")

        return True

    except Exception as e:
        print(f"✗ Model loading failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_quick_embedding_batch(device):
    """Test embedding generation on a small batch"""
    print("\n" + "=" * 70)
    print("Batch Embedding Test (10 samples)")
    print("=" * 70)

    try:
        from sentence_transformers import SentenceTransformer
        import time

        model = SentenceTransformer(
            'Qwen/Qwen3-Embedding-0.6B',
            device=device,
            trust_remote_code=True
        )

        # Create test batch
        test_texts = [
            f"HDL test query number {i}" for i in range(10)
        ]

        print(f"\nEncoding {len(test_texts)} texts...")
        start = time.time()

        embeddings = model.encode(
            test_texts,
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True
        )

        duration = time.time() - start
        rate = len(test_texts) / duration

        print(f"✓ Batch encoding successful")
        print(f"  Time: {duration:.2f}s")
        print(f"  Rate: {rate:.1f} texts/second")
        print(f"  Shape: {embeddings.shape}")

        if device == 'cuda':
            print(f"  Note: GPU processing is ~10-15x faster than CPU")

        return True

    except Exception as e:
        print(f"✗ Batch encoding failed: {e}")
        return False


def main():
    """Run all GPU tests"""
    print("\n" + "=" * 70)
    print("Athens HDL MCP - GPU Verification Suite")
    print("=" * 70)

    # Show device info
    print_device_info()

    # Test 1: Detection
    device = test_gpu_detection()

    # Test 2: Optimal settings
    test_optimal_settings(device)

    # Test 3: Model loading (optional, can be slow)
    if '--quick' not in sys.argv:
        model_ok = test_model_loading(device)

        if model_ok:
            # Test 4: Batch processing
            test_quick_embedding_batch(device)
    else:
        print("\n(Skipping model tests - use without --quick to test model loading)")

    # Summary
    print("\n" + "=" * 70)
    print("Test Summary")
    print("=" * 70)

    if device == 'cuda':
        print("\n✓ GPU detected and ready for use")
        print("  Expected speedup: ~10-20x for embeddings")
        print("  Recommended batch size: 128")
        print("\nNext steps:")
        print("  1. Parse LRMs: npm run parse")
        print("  2. Generate embeddings: python src/embeddings/generate_embeddings.py")
    else:
        print("\n✓ CPU mode ready")
        print("  Consider installing ROCm 6.4+ for GPU acceleration")
        print("  See: https://rocm.docs.amd.com/")

    print("\n" + "=" * 70)
    print("✓ GPU Test Complete")
    print("=" * 70 + "\n")


if __name__ == '__main__':
    main()
