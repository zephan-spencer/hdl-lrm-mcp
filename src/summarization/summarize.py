#!/usr/bin/env python3
"""
CLI interface for LRM summarization

Called from TypeScript to generate summaries on-demand.
"""

import sys
import json
import argparse
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from summarization.summarizer import summarize_section, extract_key_points, explain_code
except ImportError:
    # Fallback for direct execution
    from summarizer import summarize_section, extract_key_points, explain_code


def main():
    parser = argparse.ArgumentParser(description='Summarize LRM content using Qwen3')
    parser.add_argument('text', help='Text to summarize')
    parser.add_argument('--mode', choices=['summary', 'keypoints', 'explain'], 
                       default='summary', help='Summarization mode')
    parser.add_argument('--language', help='HDL language for code explanation')
    parser.add_argument('--max-length', type=int, default=150, 
                       help='Maximum length for summary')
    parser.add_argument('--max-points', type=int, default=5,
                       help='Maximum key points to extract')
    
    args = parser.parse_args()
    
    try:
        if args.mode == 'summary':
            result = summarize_section(args.text, max_length=args.max_length)
            output = {'summary': result}
        
        elif args.mode == 'keypoints':
            result = extract_key_points(args.text, max_points=args.max_points)
            output = {'key_points': result}
        
        elif args.mode == 'explain':
            if not args.language:
                raise ValueError("--language required for explain mode")
            result = explain_code(args.text, args.language, max_length=args.max_length)
            output = {'explanation': result}
        
        else:
            raise ValueError(f"Unknown mode: {args.mode}")
        
        # Output as JSON
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        # Output error as JSON
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
