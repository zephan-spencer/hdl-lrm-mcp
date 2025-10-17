#!/usr/bin/env python3
"""
Athens HDL MCP - AI Summarizer

Uses Qwen3-0.6B for local GPU/CPU-based summarization of LRM content.
Optimized for technical documentation and context efficiency.
"""

import functools
import sys
from typing import List, Optional
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from transformers import AutoTokenizer, AutoModelForCausalLM
    import torch
    from utils.gpu_utils import (
        detect_device,
        get_optimal_dtype,
        print_device_info,
        clear_gpu_cache
    )
except ImportError as e:
    print(f"Error: Failed to import transformers: {e}")
    print("Install with: pip install transformers torch")
    print("Or run: npm run setup:gpu")
    sys.exit(1)


class LRMSummarizer:
    """Summarizes LRM sections using Qwen3-0.6B for context efficiency"""
    
    def __init__(self, model_name: str = "Qwen/Qwen3-0.6B"):
        """
        Initialize summarizer with Qwen3-0.6B model

        Args:
            model_name: HuggingFace model identifier
        """
        print(f"[Summarizer] Loading {model_name}...", file=sys.stderr)

        # Auto-detect device and optimal dtype
        self.device = detect_device(verbose=False)
        self.dtype = get_optimal_dtype(self.device)

        print(f"[Summarizer] Device: {self.device.upper()}", file=sys.stderr)
        print(f"[Summarizer] Precision: {self.dtype}", file=sys.stderr)

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=self.dtype,
            device_map=self.device,
            low_cpu_mem_usage=True
        )

        self.model.eval()  # Set to evaluation mode
        print(f"[Summarizer] Model loaded successfully", file=sys.stderr)
    
    @functools.lru_cache(maxsize=200)
    def summarize_section(
        self, 
        text: str, 
        max_length: int = 150,
        task: str = "general"
    ) -> str:
        """
        Generate concise summary of LRM section
        
        Args:
            text: Section content to summarize
            max_length: Maximum summary length in words
            task: Type of summary ("general", "syntax", "rules")
        
        Returns:
            Concise summary
        """
        # Truncate input if too long (Qwen context: 32K tokens, but we limit for CPU efficiency)
        max_input_tokens = 2048
        tokens = self.tokenizer.encode(text, add_special_tokens=False)
        if len(tokens) > max_input_tokens:
            tokens = tokens[:max_input_tokens]
            text = self.tokenizer.decode(tokens, skip_special_tokens=True)
        
        # Craft task-specific prompt
        if task == "syntax":
            prompt = f"""Summarize the syntax rules from this HDL reference manual section. Focus only on syntax patterns, keywords, and grammar rules. Be concise.

Section:
{text}

Summary (syntax rules only):"""
        elif task == "rules":
            prompt = f"""Extract the key rules and constraints from this HDL reference manual section. List only the important rules. Be concise.

Section:
{text}

Key Rules:"""
        else:  # general
            prompt = f"""Summarize this HDL reference manual section in 2-3 sentences. Focus on the main concept and its purpose. Be concise and technical.

Section:
{text}

Summary:"""
        
        # Generate summary
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True)

        # Move inputs to device
        if self.device == 'cuda':
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                inputs.input_ids if self.device == 'cpu' else inputs['input_ids'],
                max_new_tokens=max_length,
                temperature=0.3,  # Low temperature for more focused output
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id
            )

        # Decode and clean
        full_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Extract just the summary part (after the prompt)
        summary = full_output[len(prompt):].strip()

        # Clean up
        summary = self._clean_summary(summary)

        # Clear GPU cache to prevent memory buildup
        if self.device == 'cuda':
            clear_gpu_cache()

        return summary
    
    def extract_key_points(
        self, 
        text: str, 
        max_points: int = 5
    ) -> List[str]:
        """
        Extract key points from text as bullet list
        
        Args:
            text: Section content
            max_points: Maximum number of key points
        
        Returns:
            List of key point strings
        """
        # Truncate input if too long
        max_input_tokens = 2048
        tokens = self.tokenizer.encode(text, add_special_tokens=False)
        if len(tokens) > max_input_tokens:
            tokens = tokens[:max_input_tokens]
            text = self.tokenizer.decode(tokens, skip_special_tokens=True)
        
        prompt = f"""Extract {max_points} key technical points from this HDL reference manual section. Format as a bullet list. Be concise and specific.

Section:
{text}

Key Points:
•"""
        
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True)

        # Move inputs to device
        if self.device == 'cuda':
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                inputs.input_ids if self.device == 'cpu' else inputs['input_ids'],
                max_new_tokens=200,
                temperature=0.3,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id
            )

        full_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Extract bullet points
        points_section = full_output[len(prompt)-1:].strip()  # -1 to keep the • we added

        # Split by bullet markers
        points = []
        for line in points_section.split('\n'):
            line = line.strip()
            # Remove bullet markers
            for marker in ['•', '*', '-', '–']:
                if line.startswith(marker):
                    line = line[1:].strip()
                    break

            # Skip empty or very short lines
            if len(line) < 10:
                continue

            # Clean up
            line = self._clean_summary(line)

            if line:
                points.append(line)

            if len(points) >= max_points:
                break

        # Clear GPU cache
        if self.device == 'cuda':
            clear_gpu_cache()

        return points[:max_points]
    
    def explain_code(
        self, 
        code: str, 
        language: str,
        max_length: int = 100
    ) -> str:
        """
        Explain what a code example demonstrates
        
        Args:
            code: Code snippet
            language: HDL language (verilog/systemverilog/vhdl)
            max_length: Maximum explanation length in words
        
        Returns:
            Plain English explanation
        """
        prompt = f"""Explain what this {language.upper()} code example demonstrates. Be concise and focus on the key concept being illustrated.

Code:
```{language}
{code}
```

Explanation:"""
        
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True)

        # Move inputs to device
        if self.device == 'cuda':
            inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model.generate(
                inputs.input_ids if self.device == 'cpu' else inputs['input_ids'],
                max_new_tokens=max_length,
                temperature=0.3,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id
            )

        full_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        explanation = full_output[len(prompt):].strip()
        explanation = self._clean_summary(explanation)

        # Clear GPU cache
        if self.device == 'cuda':
            clear_gpu_cache()

        return explanation
    
    def _clean_summary(self, text: str) -> str:
        """Clean up generated summary text"""
        # Remove common artifacts
        text = text.strip()
        
        # Remove incomplete sentences at the end
        if text and not text[-1] in '.!?':
            # Find last complete sentence
            for delimiter in ['. ', '! ', '? ']:
                last_idx = text.rfind(delimiter)
                if last_idx > 0:
                    text = text[:last_idx + 1]
                    break
        
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text


# Singleton instance for reuse
_summarizer_instance: Optional[LRMSummarizer] = None


def get_summarizer() -> LRMSummarizer:
    """Get or create summarizer singleton"""
    global _summarizer_instance
    
    if _summarizer_instance is None:
        _summarizer_instance = LRMSummarizer()
    
    return _summarizer_instance


def summarize_section(text: str, max_length: int = 150, task: str = "general") -> str:
    """Convenience function for summarizing section"""
    summarizer = get_summarizer()
    return summarizer.summarize_section(text, max_length, task)


def extract_key_points(text: str, max_points: int = 5) -> List[str]:
    """Convenience function for extracting key points"""
    summarizer = get_summarizer()
    return summarizer.extract_key_points(text, max_points)


def explain_code(code: str, language: str, max_length: int = 100) -> str:
    """Convenience function for explaining code"""
    summarizer = get_summarizer()
    return summarizer.explain_code(code, language, max_length)


if __name__ == "__main__":
    # Test the summarizer
    print("Testing LRM Summarizer...")
    
    test_text = """
    Procedural assignments are used for updating reg, integer, time, real, realtime, 
    and memory data types. There is a significant difference between procedural assignments 
    and continuous assignments: Continuous assignments drive nets and are evaluated and 
    updated whenever an input operand changes value. Procedural assignments update the 
    value of variables under the control of the procedural flow constructs that surround them.
    
    The Verilog HDL contains two types of procedural assignment statements:
    - Blocking procedural assignment statements
    - Nonblocking procedural assignment statements
    """
    
    print("\n1. General Summary:")
    summary = summarize_section(test_text)
    print(f"   {summary}")
    
    print("\n2. Key Points:")
    points = extract_key_points(test_text, 3)
    for i, point in enumerate(points, 1):
        print(f"   {i}. {point}")
    
    print("\n3. Code Explanation:")
    test_code = "always @(posedge clk) begin q <= d; end"
    explanation = explain_code(test_code, "verilog")
    print(f"   {explanation}")
    
    print("\n✓ Summarizer test complete!")
