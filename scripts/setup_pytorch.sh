#!/bin/bash
# Athens HDL MCP - Automated PyTorch Setup Script
# Detects GPU hardware and installs appropriate PyTorch version

set -e

echo "=============================================================="
echo "Athens HDL MCP - GPU Setup"
echo "=============================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Detect GPU type
detect_gpu() {
    if command -v rocm-smi &> /dev/null; then
        echo -e "${GREEN}✓ AMD GPU detected (ROCm tools found)${NC}"
        return 0
    elif command -v nvidia-smi &> /dev/null; then
        echo -e "${GREEN}✓ NVIDIA GPU detected${NC}"
        return 1
    elif lspci | grep -i 'vga.*amd' &> /dev/null; then
        echo -e "${YELLOW}⚠ AMD GPU detected but ROCm tools not found${NC}"
        echo -e "${YELLOW}  Please install ROCm 6.4+ from: https://rocm.docs.amd.com/projects/install-on-linux/en/latest/${NC}"
        return 2
    else
        echo -e "${YELLOW}⚠ No GPU detected, will install CPU-only PyTorch${NC}"
        return 3
    fi
}

# Check if virtual environment is active
check_venv() {
    if [[ -z "${VIRTUAL_ENV}" ]]; then
        echo -e "${RED}✗ Virtual environment not activated${NC}"
        echo ""
        echo "Please activate your virtual environment first:"
        echo "  source .venv/bin/activate"
        exit 1
    fi
    echo -e "${GREEN}✓ Virtual environment active: ${VIRTUAL_ENV}${NC}"
}

# Install PyTorch with ROCm 6.4
install_rocm_pytorch() {
    echo ""
    echo "Installing PyTorch 2.9.0 with ROCm 6.4 support..."
    echo "This may take a few minutes (downloading ~2-3GB)..."
    echo ""

    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.4

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PyTorch with ROCm 6.4 installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install PyTorch with ROCm${NC}"
        exit 1
    fi
}

# Install PyTorch with CUDA
install_cuda_pytorch() {
    echo ""
    echo "Installing PyTorch with CUDA support..."
    echo "This may take a few minutes (downloading ~2-3GB)..."
    echo ""

    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PyTorch with CUDA installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install PyTorch with CUDA${NC}"
        exit 1
    fi
}

# Install CPU-only PyTorch
install_cpu_pytorch() {
    echo ""
    echo "Installing CPU-only PyTorch..."
    echo ""

    uv pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ CPU-only PyTorch installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install PyTorch${NC}"
        exit 1
    fi
}

# Install other dependencies
install_dependencies() {
    echo ""
    echo "Installing other dependencies..."
    echo ""

    # Install from main requirements.txt (excluding torch)
    uv pip install docling sentence-transformers transformers pypdf

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
}

# Verify installation
verify_installation() {
    echo ""
    echo "Verifying installation..."
    echo ""

    python3 -c "
import torch
import sys

print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')

if torch.cuda.is_available():
    print(f'GPU device: {torch.cuda.get_device_name(0)}')
    print(f'GPU memory: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.1f} GB')

    # Check for ROCm
    if hasattr(torch.version, 'hip'):
        print(f'ROCm version: {torch.version.hip}')
    elif hasattr(torch.version, 'cuda'):
        print(f'CUDA version: {torch.version.cuda}')

    # Check bfloat16 support
    if torch.cuda.is_bf16_supported():
        print('bfloat16: Supported ✓')
    else:
        print('bfloat16: Not supported (will use float16)')
else:
    print('Running in CPU mode')
"

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Installation verified successfully${NC}"
        return 0
    else
        echo ""
        echo -e "${RED}✗ Verification failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo ""
    echo "Step 1: Checking virtual environment"
    echo "--------------------------------------------------------------"
    check_venv

    echo ""
    echo "Step 2: Detecting GPU hardware"
    echo "--------------------------------------------------------------"
    detect_gpu
    GPU_TYPE=$?

    echo ""
    echo "Step 3: Installing PyTorch"
    echo "--------------------------------------------------------------"

    case $GPU_TYPE in
        0)
            # AMD GPU with ROCm
            install_rocm_pytorch
            ;;
        1)
            # NVIDIA GPU
            install_cuda_pytorch
            ;;
        2)
            # AMD GPU without ROCm - exit with instructions
            echo -e "${RED}Please install ROCm first, then re-run this script${NC}"
            exit 1
            ;;
        3)
            # No GPU
            install_cpu_pytorch
            ;;
    esac

    echo ""
    echo "Step 4: Installing other dependencies"
    echo "--------------------------------------------------------------"
    install_dependencies

    echo ""
    echo "Step 5: Verifying installation"
    echo "--------------------------------------------------------------"
    verify_installation

    echo ""
    echo "=============================================================="
    echo -e "${GREEN}✓ GPU Setup Complete!${NC}"
    echo "=============================================================="
    echo ""
    echo "Next steps:"
    echo "  1. Run GPU test: npm run test:gpu"
    echo "  2. Parse LRMs: npm run parse"
    echo "  3. Generate embeddings: python src/embeddings/generate_embeddings.py"
    echo ""
}

# Run main
main
