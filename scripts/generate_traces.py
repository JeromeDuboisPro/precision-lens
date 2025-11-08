#!/usr/bin/env python3
"""
Batch Trace Generation

Generates comprehensive trace library for all precision × condition number
combinations to be used by the web dashboard.
"""

import numpy as np
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from algorithms.power_method.instrumented import PowerMethodTracer
from web.config import load_config, get_trace_filename


def generate_all_traces(
    matrix_size: int = 50,
    condition_numbers: list = None,
    output_dir: str = 'algorithms/power_method/traces',
    max_iter: int = 500
):
    """
    Generate all trace files for the precision-lens dashboard.

    Args:
        matrix_size: Size of test matrices
        condition_numbers: List of condition numbers to test
        output_dir: Directory to save trace files
        max_iter: Maximum iterations per test
    """
    if condition_numbers is None:
        condition_numbers = [10, 100, 1000]

    # Precision configurations
    # (name, dtype, simulate_fp8_flag)
    precisions = [
        ('fp64', np.float64, False),
        ('fp32', np.float32, False),
        ('fp16', np.float16, False),
        ('fp8', np.float32, True),  # FP8 is simulated using FP32
    ]

    print("=" * 70)
    print("BATCH TRACE GENERATION")
    print("=" * 70)
    print(f"\nConfiguration:")
    print(f"  Matrix size: {matrix_size}")
    print(f"  Condition numbers: {condition_numbers}")
    print(f"  Precisions: {[p[0].upper() for p in precisions]}")
    print(f"  Max iterations: {max_iter}")
    print(f"  Output directory: {output_dir}")
    print(f"\nTotal traces to generate: {len(precisions) * len(condition_numbers)}")
    print("\n" + "=" * 70)

    generated_count = 0
    failed_count = 0

    for cond_num in condition_numbers:
        print(f"\nCondition Number: {cond_num}")
        print("-" * 70)

        # Create tracer with this condition number
        tracer = PowerMethodTracer(matrix_size=matrix_size, condition_number=cond_num)

        for precision_name, dtype, simulate_fp8_flag in precisions:
            precision_label = precision_name.upper()
            try:
                print(f"\n  Running {precision_label}...", end=' ')

                # Run trace
                trace = tracer.run(
                    precision_name=precision_label,
                    dtype=dtype,
                    simulate_fp8_flag=simulate_fp8_flag,
                    max_iter=max_iter
                )

                # Generate filename using utility function
                filename = get_trace_filename(precision_name, int(cond_num), matrix_size)
                output_path = os.path.join(output_dir, filename)

                # Save trace
                tracer.save_trace(trace, output_path)

                generated_count += 1

            except Exception as e:
                print(f"❌ FAILED: {str(e)}")
                failed_count += 1
                continue

    print("\n" + "=" * 70)
    print("GENERATION COMPLETE")
    print("=" * 70)
    print(f"\n✓ Successfully generated: {generated_count} traces")
    if failed_count > 0:
        print(f"❌ Failed: {failed_count} traces")
    print(f"\nTraces saved to: {output_dir}")


def main():
    """
    Main entry point.
    Generates traces for both algorithms directory and web directory using web/config.json.
    """
    # Load configuration from web/config.json
    config = load_config()
    matrix_size = config['matrixSize']
    condition_numbers = config['conditionNumbers']

    print(f"✓ Loaded configuration from web/config.json")
    print(f"  Matrix size for web: {matrix_size}")
    print(f"  Condition numbers: {condition_numbers}")

    # Generate traces for algorithms directory (legacy, larger size)
    print("\n📁 Generating traces for algorithms/power_method/traces/")
    generate_all_traces(
        matrix_size=1000,
        condition_numbers=condition_numbers,
        output_dir='algorithms/power_method/traces',
        max_iter=500
    )

    # Generate traces for web directory (using config.json settings)
    print("\n\n📁 Generating traces for web/traces/ (using config.json settings)")
    generate_all_traces(
        matrix_size=matrix_size,
        condition_numbers=condition_numbers,
        output_dir=f"web/{config['tracesDirectory']}",
        max_iter=500
    )

    print("\n" + "=" * 70)
    print("Ready for visualization!")
    print("=" * 70)
    print(f"\n✓ Web traces generated with matrix size n={matrix_size}")
    print(f"✓ Configuration controlled by web/config.json")


if __name__ == '__main__':
    main()
