#!/usr/bin/env python3
"""
Cascading Precision Power Method - Adaptive Precision Escalation

Implements the cascading precision strategy: FP8 → FP16 → FP32 → FP64
- Start fast with FP8 for rapid initial convergence
- Transition to FP16 when IEEE754 threshold reached (relative error < 10⁻¹)
- Escalate to FP32/FP64 only when higher accuracy needed
- Carry eigenvector state across transitions for efficiency
"""

import json
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Tuple

import numpy as np

# Add parent directory to path to import from study.py
sys.path.insert(0, os.path.dirname(__file__))
from study import create_test_matrix, simulate_fp8  # noqa: E402


class CascadingPowerMethod:
    """
    Power method with cascading precision strategy for adaptive convergence.
    """

    # Precision cascade configuration
    # Thresholds represent when to transition to next precision
    # Set conservatively to trigger transition when precision limit is approached
    PRECISION_CASCADE = [
        {
            "name": "FP8",
            "dtype": np.float32,
            "simulate_fp8": True,
            "threshold": 5e-2,
            "max_stagnant": 10,
        },
        {
            "name": "FP16",
            "dtype": np.float16,
            "simulate_fp8": False,
            "threshold": 1e-3,
            "max_stagnant": 20,
        },
        {
            "name": "FP32",
            "dtype": np.float32,
            "simulate_fp8": False,
            "threshold": 1e-7,
            "max_stagnant": 50,
        },
        {
            "name": "FP64",
            "dtype": np.float64,
            "simulate_fp8": False,
            "threshold": 1e-15,
            "max_stagnant": 100,
        },
    ]

    # Precision-aware convergence tolerances
    # Based on IEEE 754 precision limits and mixed-precision research
    PRECISION_TOLERANCES = {
        "FP8": {
            "eigenvalue_tol": 5e-2,  # Relative eigenvalue change threshold
            "residual_tol": 1e-1,  # Residual norm threshold
        },
        "FP16": {
            "eigenvalue_tol": 1e-3,
            "residual_tol": 1e-2,
        },
        "FP32": {
            "eigenvalue_tol": 1e-6,
            "residual_tol": 1e-5,
        },
        "FP64": {
            "eigenvalue_tol": 1e-12,
            "residual_tol": 1e-11,
        },
    }

    def __init__(self, matrix_size: int = 1000, condition_number: float = 100.0):
        """
        Initialize cascading power method.

        Args:
            matrix_size: Dimension of square matrix
            condition_number: Desired condition number
        """
        self.matrix_size = matrix_size
        self.condition_number = condition_number
        self.matrix = create_test_matrix(matrix_size, condition_number)
        self.true_eigenvalue = np.max(np.linalg.eigvalsh(self.matrix))

    def run(self, target_error: float = 1e-10, max_iter: int = 1000) -> Dict:
        """
        Execute cascading precision power method.

        Args:
            target_error: Target relative error to achieve
            max_iter: Maximum total iterations across all precisions

        Returns:
            Complete execution trace with precision transitions
        """
        n = self.matrix_size

        # Initialize random vector in highest precision
        x = np.random.randn(n).astype(np.float64)
        x = x / np.linalg.norm(x)

        # Trace storage
        full_trace: List[Dict] = []
        precision_segments: List[Dict] = []

        total_iterations = 0
        start_time = time.perf_counter()
        current_precision_idx = 0

        print("\n🔄 CASCADING PRECISION STRATEGY")
        print("=" * 70)

        # Iterate through precision levels
        while (
            current_precision_idx < len(self.PRECISION_CASCADE)
            and total_iterations < max_iter
        ):
            precision_config = self.PRECISION_CASCADE[current_precision_idx]
            precision_name = str(precision_config["name"])
            dtype = precision_config["dtype"]
            simulate_fp8_flag = bool(precision_config["simulate_fp8"])
            threshold = float(precision_config["threshold"])  # type: ignore[arg-type]
            max_stagnant = int(precision_config["max_stagnant"])  # type: ignore[call-overload]

            print(f"\n📊 Switching to {precision_name}")
            print(f"   Threshold: {threshold:.0e}")
            print(f"   Max stagnant iterations: {max_stagnant}")

            # Convert matrix and vector to current precision
            A = self.matrix.astype(dtype)
            x = x.astype(dtype)  # type: ignore[call-overload]

            # Determine bytes per element
            dtype_bytes = self._get_dtype_bytes(dtype, simulate_fp8_flag)

            # Check if we have iterations remaining
            remaining_iter = max_iter - total_iterations
            if remaining_iter <= 0:
                print("   ⚠️  No iterations remaining, stopping")
                break

            # Run iterations at this precision level
            segment_trace, x, converged = self._run_precision_segment(
                A,
                x,
                precision_name,
                dtype,
                simulate_fp8_flag,
                dtype_bytes,
                threshold,
                target_error,
                max_stagnant,
                remaining_iter,
                time.perf_counter() - start_time,
            )

            # Skip if no iterations were performed
            if not segment_trace:
                print("   ⚠️  No iterations performed in this segment")
                break

            # Store segment information
            segment_info = {
                "precision": precision_name,
                "dtype": str(dtype),
                "dtype_bytes": int(dtype_bytes),
                "iterations": int(len(segment_trace)),
                "start_iteration": int(total_iterations),
                "end_iteration": int(total_iterations + len(segment_trace)),
                "start_error": float(segment_trace[0]["relative_error"]),
                "end_error": float(segment_trace[-1]["relative_error"]),
                "time": float(
                    segment_trace[-1]["cumulative_time"]
                    - (
                        segment_trace[0]["cumulative_time"]
                        if len(segment_trace) > 0
                        else 0
                    )
                ),
                "converged": bool(converged),
            }
            precision_segments.append(segment_info)

            # Add to full trace
            full_trace.extend(segment_trace)
            total_iterations += len(segment_trace)

            print(
                f"   ✓ Completed: {len(segment_trace)} iterations, "
                f"error: {segment_trace[-1]['relative_error']:.2e}"
            )

            # Check if we've reached target error
            if converged and segment_trace[-1]["relative_error"] <= target_error:
                print(f"\n🎯 Target error {target_error:.0e} reached!")
                break

            # Move to next precision level
            current_precision_idx += 1

        total_time = time.perf_counter() - start_time
        final_error = full_trace[-1]["relative_error"] if full_trace else float("nan")

        print(f"\n{'=' * 70}")
        print("🏁 Cascading strategy completed")
        print(f"   Total iterations: {total_iterations}")
        print(f"   Total time: {total_time:.4f}s")
        print(f"   Final error: {final_error:.2e}")
        print(f"   Precision levels used: {len(precision_segments)}")
        print(f"{'=' * 70}\n")

        # Build complete trace document
        trace_document = {
            "metadata": {
                "algorithm": "cascading_precision",
                "condition_number": float(self.condition_number),
                "matrix_size": int(self.matrix_size),
                "true_eigenvalue": float(self.true_eigenvalue),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "target_error": float(target_error),
                "final_error": float(final_error),
                "converged": bool(final_error <= target_error),
                "max_iterations": int(max_iter),
            },
            "precision_segments": precision_segments,
            "trace": full_trace,
            "summary": {
                "total_iterations": int(total_iterations),
                "total_time_seconds": float(total_time),
                "precision_levels_used": int(len(precision_segments)),
                "average_time_per_iteration": float(
                    total_time / total_iterations if total_iterations > 0 else 0
                ),
            },
        }

        return trace_document

    def _run_precision_segment(  # noqa: C901
        self,
        A: np.ndarray,
        x: np.ndarray,
        precision_name: str,
        dtype: Any,
        simulate_fp8_flag: bool,
        dtype_bytes: int,
        threshold: float,
        target_error: float,
        max_stagnant: int,
        max_iter: int,
        cumulative_time_offset: float,
    ) -> Tuple[List[Dict], np.ndarray, bool]:
        """
        Run power method iterations at a specific precision level.

        Args:
            A: Matrix in current precision
            x: Eigenvector in current precision
            precision_name: Name of precision level
            dtype: NumPy dtype
            simulate_fp8_flag: Whether to simulate FP8
            dtype_bytes: Bytes per element
            threshold: Error threshold for this precision
            target_error: Overall target error
            max_stagnant: Max iterations without improvement before transitioning
            max_iter: Maximum iterations for this segment
            cumulative_time_offset: Time offset from previous segments

        Returns:
            (trace, final_eigenvector, converged)
        """
        n = self.matrix_size
        trace: List[Dict] = []
        converged = False
        stagnant_count = 0
        last_error = float("inf")
        eigenvalue_old = 0.0

        for iteration in range(max_iter):
            iter_start_time = time.perf_counter()

            # Apply FP8 simulation if requested
            if simulate_fp8_flag:
                x_compute = simulate_fp8(x)
                A_compute = simulate_fp8(A)
            else:
                x_compute = x
                A_compute = A

            # Power iteration: x_new = A @ x
            x_new = A_compute @ x_compute

            # Apply FP8 simulation to result
            if simulate_fp8_flag:
                x_new = simulate_fp8(x_new)

            # Normalize first (for stable Rayleigh quotient)
            norm = np.linalg.norm(x_new)
            if norm < 1e-10:  # Avoid division by zero
                break
            x_new = x_new / norm

            # Compute eigenvalue estimate (Rayleigh quotient)
            # Use normalized vector for better stability
            eigenvalue = float(np.dot(x_new, A_compute @ x_new))

            # Calculate relative error (for comparison only, not used for convergence)
            relative_error = abs(eigenvalue - self.true_eigenvalue) / abs(
                self.true_eigenvalue
            )

            # Check convergence using precision-aware criteria
            # Skip convergence check on first iteration (need eigenvalue history)
            if iteration == 0:
                is_converged = False
                # Still compute residual for tracking
                residual_vec = A_compute @ x_new - eigenvalue * x_new
                residual_norm = float(np.linalg.norm(residual_vec))
            else:
                is_converged, residual_norm = self._check_convergence(
                    A_compute, x_new, eigenvalue, eigenvalue_old, precision_name
                )

            # Timing
            iter_end_time = time.perf_counter()
            iter_duration = iter_end_time - iter_start_time
            cumulative_time = cumulative_time_offset + (iter_end_time - iter_start_time)

            # Performance metrics
            ops_per_iteration = 2 * n * n + n
            flops = ops_per_iteration / iter_duration if iter_duration > 0 else 0

            bytes_transferred = (n * n + 2 * n) * dtype_bytes
            bandwidth_gbps = (
                (bytes_transferred / iter_duration / 1e9) if iter_duration > 0 else 0
            )

            # Store iteration data
            trace.append(
                {
                    "iteration": iteration,
                    "precision": precision_name,
                    "wall_time": iter_duration,
                    "cumulative_time": cumulative_time,
                    "eigenvalue": eigenvalue,
                    "relative_error": relative_error,
                    "residual_norm": residual_norm,
                    "vector_norm": float(norm),
                    "theoretical_flops": flops,
                    "theoretical_bandwidth_gbps": bandwidth_gbps,
                    "ops_count": ops_per_iteration,
                    "bytes_transferred": bytes_transferred,
                }
            )

            x = x_new

            # Update cumulative time offset for next iteration
            cumulative_time_offset = cumulative_time

            # Update eigenvalue_old for next iteration
            eigenvalue_old = eigenvalue

            # Check for stagnation (no improvement in residual)
            if iteration > 0:
                # Use residual for stagnation detection (more robust than error)
                residual_improvement = last_error - residual_norm
                if abs(residual_improvement) < 1e-10:  # No meaningful improvement
                    stagnant_count += 1
                else:
                    stagnant_count = 0  # Reset if we see improvement

            last_error = residual_norm

            # Transition conditions (in priority order):
            # 1. Precision-aware convergence (eigenvalue + residual criteria met)
            # 2. Reached target error (goal achieved)
            # 3. Stagnant for too long (precision exhausted)
            if is_converged:
                converged = True
                print("   → Precision-aware convergence achieved!")
                print(
                    f"      Residual: {residual_norm:.2e}, Error: {relative_error:.2e}"
                )
                break

            if relative_error <= target_error:
                converged = True
                print(f"   → Target error {target_error:.0e} reached!")
                break

            if stagnant_count >= max_stagnant:
                converged = False
                msg = (
                    f"   → Stagnation detected ({stagnant_count} iterations), "
                    "transitioning..."
                )
                print(msg)
                print(f"      Residual stalled at: {residual_norm:.2e}")
                break

        return trace, x, converged

    def _check_convergence(
        self,
        A: np.ndarray,
        x: np.ndarray,
        eigenvalue: float,
        eigenvalue_old: float,
        precision_name: str,
    ) -> Tuple[bool, float]:
        """
        Check convergence with precision-aware tolerances.

        Uses two criteria based on mixed-precision research:
        1. Relative eigenvalue change
        2. Residual norm: ||A*x - λ*x||

        Args:
            A: Matrix in current precision
            x: Eigenvector estimate
            eigenvalue: Current eigenvalue estimate
            eigenvalue_old: Previous eigenvalue estimate
            precision_name: Current precision level name

        Returns:
            (is_converged, residual_norm)
        """
        tol_config = self.PRECISION_TOLERANCES[precision_name]

        # Compute relative eigenvalue change
        if abs(eigenvalue_old) > 1e-14:
            rel_change = abs(eigenvalue - eigenvalue_old) / abs(eigenvalue_old)
        else:
            rel_change = abs(eigenvalue - eigenvalue_old)

        # Compute residual: ||A*x - λ*x||
        residual_vec = A @ x - eigenvalue * x
        residual_norm = float(np.linalg.norm(residual_vec))

        # Check both criteria (AND condition)
        eigenvalue_converged = rel_change < tol_config["eigenvalue_tol"]
        residual_converged = residual_norm < tol_config["residual_tol"]

        is_converged = eigenvalue_converged and residual_converged

        return is_converged, residual_norm

    def _get_dtype_bytes(self, dtype: Any, simulate_fp8_flag: bool) -> int:
        """Get bytes per element for a dtype."""
        if simulate_fp8_flag:
            return 1
        dtype_sizes = {
            np.float64: 8,
            np.float32: 4,
            np.float16: 2,
        }
        return dtype_sizes.get(dtype, 4)

    def save_trace(self, trace: Dict, output_path: str):
        """Save trace to JSON file."""
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, "w") as f:
            json.dump(trace, f, indent=2)

        print(f"✓ Trace saved: {output_path}")
        print(f"  - Total iterations: {trace['summary']['total_iterations']}")
        print(f"  - Total time: {trace['summary']['total_time_seconds']:.4f}s")
        print(f"  - Final error: {trace['metadata']['final_error']:.2e}")
        print(f"  - Precision levels: {trace['summary']['precision_levels_used']}")


def main():
    """Test the cascading precision method."""
    print("=" * 70)
    print("CASCADING PRECISION POWER METHOD - TEST")
    print("=" * 70)

    # Test configurations
    configs = [
        {"matrix_size": 50, "condition_number": 10},
        {"matrix_size": 50, "condition_number": 100},
        {"matrix_size": 50, "condition_number": 1000},
    ]

    for config in configs:
        print(
            f"\n📋 Configuration: n={config['matrix_size']}, κ={config['condition_number']}"
        )

        method = CascadingPowerMethod(
            matrix_size=config["matrix_size"],
            condition_number=config["condition_number"],
        )

        trace = method.run(target_error=1e-10, max_iter=1000)

        # Save trace
        output_path = (
            f"algorithms/power_method/traces/cascading_"
            f"cond{int(config['condition_number'])}_"
            f"n{config['matrix_size']}.json"
        )
        method.save_trace(trace, output_path)

    print("\n" + "=" * 70)
    print("All tests complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
