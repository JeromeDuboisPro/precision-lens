#!/usr/bin/env python3
"""Analyze FP convergence from trace files."""

import json
from pathlib import Path
from typing import Dict, List, Tuple

def analyze_trace_file(file_path: Path) -> Dict:
    """Extract convergence info from a trace file."""
    with open(file_path, 'r') as f:
        data = json.load(f)

    metadata = data['metadata']
    return {
        'file': file_path.name,
        'precision': metadata['precision'],
        'condition_number': metadata['condition_number'],
        'matrix_size': metadata['matrix_size'],
        'converged': metadata['converged'],
        'convergence_iteration': metadata.get('convergence_iteration'),
        'final_error': metadata['final_error'],
        'tolerance': metadata['tolerance'],
        'total_iterations': data['summary']['total_iterations']
    }

def main():
    # Find all trace files
    trace_dirs = [
        Path('algorithms/power_method/traces'),
        Path('web/traces')
    ]

    results_by_precision = {
        'FP8': [],
        'FP16': [],
        'FP32': [],
        'FP64': []
    }

    for trace_dir in trace_dirs:
        if not trace_dir.exists():
            continue

        for trace_file in sorted(trace_dir.glob('*.json')):
            if trace_file.name == 'test_fp32_cond100.json':
                continue  # Skip test file

            try:
                result = analyze_trace_file(trace_file)
                precision = result['precision']
                results_by_precision[precision].append(result)
            except Exception as e:
                print(f"Error processing {trace_file}: {e}")

    # Print summary by precision
    print("=" * 80)
    print("FP CONVERGENCE ANALYSIS")
    print("=" * 80)

    for precision in ['FP64', 'FP32', 'FP16', 'FP8']:
        results = results_by_precision[precision]
        if not results:
            continue

        print(f"\n{precision}:")
        print("-" * 80)

        for result in sorted(results, key=lambda x: (x['matrix_size'], x['condition_number'])):
            cond = result['condition_number']
            n = result['matrix_size']
            converged = result['converged']
            conv_iter = result['convergence_iteration']
            total_iter = result['total_iterations']
            final_err = result['final_error']

            if converged:
                print(f"  cond={cond:>4}, n={n:>4}: ✓ Converged at iteration {conv_iter:>4} (final error: {final_err:.2e})")
            else:
                print(f"  cond={cond:>4}, n={n:>4}: ✗ Did NOT converge after {total_iter} iterations (final error: {final_err:.2e})")

    # Summary table
    print("\n" + "=" * 80)
    print("CONVERGENCE SUMMARY TABLE")
    print("=" * 80)
    print(f"{'Precision':<10} {'Cond':<10} {'Matrix Size':<12} {'Converged':<12} {'Iteration':<15}")
    print("-" * 80)

    for precision in ['FP64', 'FP32', 'FP16', 'FP8']:
        results = results_by_precision[precision]
        for result in sorted(results, key=lambda x: (x['matrix_size'], x['condition_number'])):
            cond = result['condition_number']
            n = result['matrix_size']
            converged = "Yes" if result['converged'] else "No"
            conv_iter = result['convergence_iteration'] if result['convergence_iteration'] is not None else "N/A"

            print(f"{precision:<10} {cond:<10.0f} {n:<12} {converged:<12} {conv_iter}")

if __name__ == '__main__':
    main()
