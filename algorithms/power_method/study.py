#!/usr/bin/env python3
"""
Power Method Eigenvalue Computation: Precision Impact Study

Demonstrates how reduced floating-point precision affects convergence
of the power method algorithm across different matrix condition numbers.

Precisions tested:
- FP64 (float64): Standard double precision
- FP32 (float32): Single precision
- FP16 (float16): Half precision
- FP8: Simulated via mantissa quantization
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for headless environments
import matplotlib.pyplot as plt
from matplotlib.ticker import LogFormatterMathtext
from typing import Tuple, List
import warnings

warnings.filterwarnings('ignore')


def simulate_fp8(x: np.ndarray) -> np.ndarray:
    """
    Simulate FP8 arithmetic by quantizing mantissa to ~3 bits.

    FP8 formats typically have 1 sign bit, 4-5 exponent bits, 2-3 mantissa bits.
    We simulate this by aggressive rounding of the mantissa.

    Args:
        x: Input array in any precision

    Returns:
        Array with FP8-like precision
    """
    # Convert to float32 for processing
    x = x.astype(np.float32)

    # Extract sign, exponent, and mantissa components
    sign = np.sign(x)
    abs_x = np.abs(x)

    # Handle zeros and very small numbers
    mask = abs_x > 1e-10

    # Quantize to ~3 mantissa bits (8 levels)
    # This is a simplified simulation
    quantized = np.zeros_like(abs_x)
    quantized[mask] = np.round(abs_x[mask] * 8) / 8

    return sign * quantized


def power_method(A: np.ndarray, max_iter: int = 1000, tol: float = 1e-10,
                 dtype=np.float64, simulate_fp8_flag: bool = False) -> Tuple[float, List[float]]:
    """
    Power method for computing the dominant eigenvalue.

    Args:
        A: Square matrix
        max_iter: Maximum iterations
        tol: Convergence tolerance
        dtype: Data type for computation (np.float64, np.float32, np.float16)
        simulate_fp8_flag: If True, simulate FP8 precision

    Returns:
        Tuple of (dominant eigenvalue, convergence history)
    """
    n = A.shape[0]

    # Convert matrix to desired precision
    A = A.astype(dtype)

    # Initialize random vector
    x = np.random.randn(n).astype(dtype)
    x = x / np.linalg.norm(x)

    eigenvalue_history = []

    for i in range(max_iter):
        # Apply FP8 simulation if requested
        if simulate_fp8_flag:
            x = simulate_fp8(x)
            A_compute = simulate_fp8(A)
        else:
            A_compute = A

        # Power iteration: x_new = A @ x
        x_new = A_compute @ x

        # Apply FP8 simulation to result
        if simulate_fp8_flag:
            x_new = simulate_fp8(x_new)

        # Compute eigenvalue estimate (Rayleigh quotient)
        eigenvalue = np.dot(x_new, x)
        eigenvalue_history.append(float(eigenvalue))

        # Normalize
        norm = np.linalg.norm(x_new)
        if norm < 1e-10:  # Avoid division by zero
            break
        x_new = x_new / norm

        # Check convergence
        if i > 0 and abs(eigenvalue_history[-1] - eigenvalue_history[-2]) < tol:
            break

        x = x_new

    return eigenvalue_history[-1], eigenvalue_history


def create_test_matrix(n: int, condition_number: float) -> np.ndarray:
    """
    Create a symmetric positive definite matrix with specified condition number.

    Args:
        n: Matrix dimension
        condition_number: Desired condition number (ratio of max/min eigenvalue)

    Returns:
        n x n symmetric positive definite matrix
    """
    # Create eigenvalues linearly spaced to achieve desired condition number
    max_eigenvalue = condition_number
    min_eigenvalue = 1.0
    eigenvalues = np.linspace(min_eigenvalue, max_eigenvalue, n)

    # Create random orthogonal matrix
    Q, _ = np.linalg.qr(np.random.randn(n, n))

    # Construct matrix: A = Q @ diag(eigenvalues) @ Q.T
    A = Q @ np.diag(eigenvalues) @ Q.T

    return A


def run_convergence_study():
    """
    Run power method convergence study across precisions and condition numbers.
    """
    # Configuration
    matrix_size = 1000
    condition_numbers = [10, 100, 1000]
    max_iterations = 500

    # Precision configurations
    precisions = [
        ('FP64', np.float64, False),
        ('FP32', np.float32, False),
        ('FP16', np.float16, False),
        ('FP8 (simulated)', np.float32, True),
    ]

    # Create figure with subplots
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    fig.suptitle('Power Method Convergence: Precision Impact', fontsize=14, fontweight='bold')

    for idx, cond_num in enumerate(condition_numbers):
        ax = axes[idx]

        # Create test matrix
        print(f"\nCondition Number: {cond_num}")
        A = create_test_matrix(matrix_size, cond_num)

        # Compute true eigenvalue for reference
        true_eigenvalue = np.max(np.linalg.eigvalsh(A))
        print(f"True dominant eigenvalue: {true_eigenvalue:.6f}")

        # Test each precision
        for precision_name, dtype, simulate_fp8_flag in precisions:
            try:
                final_eigenvalue, history = power_method(
                    A,
                    max_iter=max_iterations,
                    dtype=dtype,
                    simulate_fp8_flag=simulate_fp8_flag
                )

                # Compute relative error
                errors = [abs(ev - true_eigenvalue) / abs(true_eigenvalue) for ev in history]

                # Plot convergence
                ax.semilogy(errors, label=precision_name, linewidth=2, alpha=0.8)

                print(f"  {precision_name:20s}: {final_eigenvalue:12.6f} "
                      f"(error: {abs(final_eigenvalue - true_eigenvalue)/abs(true_eigenvalue):.2e}, "
                      f"iters: {len(history)})")

            except Exception as e:
                print(f"  {precision_name:20s}: Failed - {str(e)}")

        # Configure subplot
        ax.set_xlabel('Iteration', fontsize=10)
        ax.set_ylabel('Relative Error', fontsize=10)
        ax.set_title(f'Condition Number = {cond_num}', fontsize=11, fontweight='bold')
        ax.grid(True, alpha=0.3, linestyle='--')
        ax.legend(fontsize=8, loc='best')
        ax.set_ylim([1e-10, 10])
        ax.yaxis.set_major_formatter(LogFormatterMathtext())

    plt.tight_layout()

    # Save figure
    output_path = 'results/convergence_comparison.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\n✓ Plot saved to {output_path}")


def run_precision_degradation_study():
    """
    Study how precision degradation affects final accuracy.
    """
    matrix_size = 1000
    condition_numbers = np.logspace(1, 3, 10)  # 10 to 1000

    precisions = [
        ('FP64', np.float64, False),
        ('FP32', np.float32, False),
        ('FP16', np.float16, False),
        ('FP8 (simulated)', np.float32, True),
    ]

    fig, ax = plt.subplots(figsize=(10, 6))

    for precision_name, dtype, simulate_fp8_flag in precisions:
        final_errors = []

        for cond_num in condition_numbers:
            A = create_test_matrix(matrix_size, cond_num)
            true_eigenvalue = np.max(np.linalg.eigvalsh(A))

            try:
                final_eigenvalue, _ = power_method(
                    A,
                    max_iter=500,
                    dtype=dtype,
                    simulate_fp8_flag=simulate_fp8_flag
                )

                relative_error = abs(final_eigenvalue - true_eigenvalue) / abs(true_eigenvalue)
                final_errors.append(relative_error)
            except:
                final_errors.append(np.nan)

        ax.loglog(condition_numbers, final_errors, 'o-', label=precision_name,
                  linewidth=2, markersize=6, alpha=0.8)

    ax.set_xlabel('Condition Number', fontsize=12)
    ax.set_ylabel('Final Relative Error', fontsize=12)
    ax.set_title('Precision Impact vs Matrix Condition Number', fontsize=14, fontweight='bold')
    ax.grid(True, alpha=0.3, linestyle='--', which='both')
    ax.legend(fontsize=10, loc='best')
    ax.xaxis.set_major_formatter(LogFormatterMathtext())
    ax.yaxis.set_major_formatter(LogFormatterMathtext())

    plt.tight_layout()

    # Save figure
    output_path = 'results/precision_degradation.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\n✓ Plot saved to {output_path}")


if __name__ == '__main__':
    print("=" * 70)
    print("POWER METHOD PRECISION STUDY")
    print("=" * 70)
    print("\nStudying convergence degradation across FP64, FP32, FP16, and FP8...")

    # Run main convergence study
    print("\n" + "-" * 70)
    print("Study 1: Convergence Comparison")
    print("-" * 70)
    run_convergence_study()

    # Run precision degradation study
    print("\n" + "-" * 70)
    print("Study 2: Precision Degradation vs Condition Number")
    print("-" * 70)
    run_precision_degradation_study()

    print("\n" + "=" * 70)
    print("STUDY COMPLETE")
    print("=" * 70)
    print("\nResults saved in results/ directory.")
    print("View the plots to see how precision affects convergence!")
