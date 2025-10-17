#!/usr/bin/env python3
"""
Athens HDL MCP - GPU Utilities
Provides GPU detection, optimization, and configuration utilities for AMD/NVIDIA GPUs
"""

import sys
from typing import Dict, Optional, Tuple

try:
    import torch
except ImportError:
    print("Error: PyTorch not installed. Install with: uv pip install torch", file=sys.stderr)
    sys.exit(1)


def detect_device(verbose: bool = True) -> str:
    """
    Detect and return the best available device (cuda/cpu)

    Args:
        verbose: Print device information

    Returns:
        'cuda' if GPU available, 'cpu' otherwise
    """
    device = 'cuda' if torch.cuda.is_available() else 'cpu'

    if verbose:
        if device == 'cuda':
            gpu_name = torch.cuda.get_device_name(0)
            print(f"[GPU] Detected: {gpu_name}", file=sys.stderr)
        else:
            print("[CPU] No GPU detected, using CPU", file=sys.stderr)

    return device


def get_gpu_info() -> Dict[str, any]:
    """
    Get detailed GPU information

    Returns:
        Dictionary with GPU details (name, memory, etc.)
    """
    if not torch.cuda.is_available():
        return {
            'available': False,
            'name': 'CPU',
            'device': 'cpu'
        }

    device_id = 0
    props = torch.cuda.get_device_properties(device_id)

    info = {
        'available': True,
        'device': 'cuda',
        'name': torch.cuda.get_device_name(device_id),
        'memory_gb': props.total_memory / (1024**3),
        'compute_capability': f"{props.major}.{props.minor}",
        'multi_processor_count': props.multi_processor_count,
    }

    # Try to get ROCm version (AMD GPUs)
    try:
        # ROCm info is available through torch.version
        if hasattr(torch.version, 'hip'):
            info['backend'] = 'ROCm'
            info['rocm_version'] = torch.version.hip
        else:
            info['backend'] = 'CUDA'
            info['cuda_version'] = torch.version.cuda
    except:
        info['backend'] = 'Unknown'

    return info


def get_gpu_memory_info() -> Tuple[float, float]:
    """
    Get current GPU memory usage (includes PyTorch's reserved cache)

    Returns:
        Tuple of (used_gb, total_gb)
        used_gb includes both allocated tensors AND PyTorch's memory cache
    """
    if not torch.cuda.is_available():
        return (0.0, 0.0)

    # Use memory_reserved instead of memory_allocated
    # memory_reserved shows actual GPU memory held by PyTorch (including cache)
    # memory_allocated only shows active tensors (misleading during cache buildup)
    reserved = torch.cuda.memory_reserved(0) / (1024**3)
    total = torch.cuda.get_device_properties(0).total_memory / (1024**3)

    return (reserved, total)


def get_optimal_dtype(device: str) -> torch.dtype:
    """
    Get optimal dtype for device

    Args:
        device: 'cuda' or 'cpu'

    Returns:
        torch.bfloat16 for GPU (RDNA 3+), torch.float32 for CPU
    """
    if device == 'cuda':
        # Check if bfloat16 is supported
        # RDNA 3+ (RX 7000 series, RX 9000 series) support bfloat16
        # For ROCm 6.4, bfloat16 is well supported
        if torch.cuda.is_bf16_supported():
            return torch.bfloat16
        else:
            # Fallback to float16 if bfloat16 not supported
            return torch.float16
    else:
        return torch.float32


def get_optimal_batch_size(base_size: int, device: str) -> int:
    """
    Get optimal batch size based on device

    Args:
        base_size: Base batch size for CPU
        device: 'cuda' or 'cpu'

    Returns:
        Adjusted batch size (4x for GPU)
    """
    if device == 'cuda':
        # GPU can handle larger batches
        # RX 9070 XT has 16GB VRAM - can easily handle 4x batch size
        return base_size * 4
    else:
        return base_size


def print_device_info():
    """Print formatted device information"""
    info = get_gpu_info()

    print("\n" + "=" * 70, file=sys.stderr)
    print("Device Configuration", file=sys.stderr)
    print("=" * 70, file=sys.stderr)

    if info['available']:
        print(f"  Device: {info['device'].upper()}", file=sys.stderr)
        print(f"  Name: {info['name']}", file=sys.stderr)
        print(f"  Memory: {info['memory_gb']:.1f} GB", file=sys.stderr)
        print(f"  Compute: {info['compute_capability']}", file=sys.stderr)
        print(f"  Backend: {info.get('backend', 'Unknown')}", file=sys.stderr)

        if 'rocm_version' in info:
            print(f"  ROCm: {info['rocm_version']}", file=sys.stderr)
        elif 'cuda_version' in info:
            print(f"  CUDA: {info['cuda_version']}", file=sys.stderr)

        # Show dtype recommendation
        dtype = get_optimal_dtype('cuda')
        print(f"  Precision: {dtype}", file=sys.stderr)
    else:
        print(f"  Device: CPU", file=sys.stderr)
        print(f"  Precision: {torch.float32}", file=sys.stderr)

    print("=" * 70, file=sys.stderr)


def check_gpu_available() -> bool:
    """
    Simple check if GPU is available

    Returns:
        True if GPU available, False otherwise
    """
    return torch.cuda.is_available()


def clear_gpu_cache():
    """Clear GPU memory cache"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


if __name__ == '__main__':
    # Test GPU detection
    print("Athens HDL MCP - GPU Detection Test")
    print_device_info()

    device = detect_device()

    if device == 'cuda':
        used, total = get_gpu_memory_info()
        print(f"\nGPU Memory: {used:.2f}GB / {total:.1f}GB")
        print(f"Optimal batch size (base=32): {get_optimal_batch_size(32, device)}")
        print(f"Optimal dtype: {get_optimal_dtype(device)}")

    print("\n✓ GPU detection test complete")
