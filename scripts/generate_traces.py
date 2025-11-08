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

                # Generate filename
                filename = f"{precision_name}_cond{int(cond_num)}_n{matrix_size}.json"
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
    """
    # Generate standard trace library
    generate_all_traces(
        matrix_size=50,
        condition_numbers=[10, 100, 1000],
        output_dir='algorithms/power_method/traces',
        max_iter=500
    )

    print("\n" + "=" * 70)
    print("Ready for visualization!")
    print("=" * 70)


if __name__ == '__main__':
    main()
