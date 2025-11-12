#!/usr/bin/env python3
"""
Instrumented Power Method - Detailed Performance Tracing

Captures complete execution trace including timing, FLOPS, memory bandwidth,
and convergence history for visualization and analysis.
"""

import json
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

# Add parent directory to path to import from study.py
sys.path.insert(0, os.path.dirname(__file__))
from study import create_test_matrix, simulate_fp8  # noqa: E402


class PowerMethodTracer:
    """
    Instrumented power method that captures detailed execution trace.
    """

    # IEEE754 precision thresholds - stop when relative error goes below these values
    IEEE754_THRESHOLDS = {"FP64": 1e-15, "FP32": 1e-7, "FP16": 1e-3, "FP8": 1e-1}

    # Precision-aware convergence tolerances (same as cascading strategy)
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
        Initialize tracer with matrix configuration.

        Args:
            matrix_size: Dimension of square matrix
            condition_number: Desired condition number
        """
        self.matrix_size = matrix_size
        self.condition_number = condition_number
        self.matrix = create_test_matrix(matrix_size, condition_number)
        self.true_eigenvalue = np.max(np.linalg.eigvalsh(self.matrix))

    def run(  # noqa: C901
        self,
        precision_name: str,
        dtype: Any,  # np.dtype or type like np.float32
        simulate_fp8_flag: bool = False,
        max_iter: int = 1000,
        tol: float = 1e-10,
    ) -> Dict:
        """
        Execute power method with complete instrumentation.

        Args:
            precision_name: Human-readable precision name (e.g., "FP32")
            dtype: NumPy dtype for computation
            simulate_fp8_flag: Whether to simulate FP8 precision
            max_iter: Maximum iterations
            tol: Convergence tolerance

        Returns:
            Complete execution trace as dictionary
        """
        n = self.matrix_size
        A = self.matrix.astype(dtype)

        # Determine bytes per element
        dtype_sizes = {
            np.float64: 8,
            np.float32: 4,
            np.float16: 2,
        }
        if simulate_fp8_flag:
            dtype_bytes = 1  # Simulated FP8
        else:
            dtype_bytes = dtype_sizes.get(dtype, 4)

        # Initialize random vector
        x = np.random.randn(n).astype(dtype)
        x = x / np.linalg.norm(x)

        # Trace storage
        trace: List[Dict] = []
        converged = False
        convergence_iteration = None
        eigenvalue_old = 0.0

        # IEEE754 threshold tracking
        ieee754_threshold = self.IEEE754_THRESHOLDS.get(precision_name, None)
        threshold_reached = False
        threshold_iteration = None

        # Start timing
        start_time = time.perf_counter()

        for iteration in range(max_iter):
            iter_start_time = time.perf_counter()

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

            # Normalize first (for stable Rayleigh quotient)
            norm = np.linalg.norm(x_new)
            if norm < 1e-10:  # Avoid division by zero
                break
            x_new = x_new / norm

            # Compute eigenvalue estimate (Rayleigh quotient)
            # Use normalized vector for better stability
            eigenvalue = float(np.dot(x_new, A_compute @ x_new))

            # Calculate relative error (for comparison only)
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
            cumulative_time = iter_end_time - start_time

            # Performance metrics
            # FLOPS: Matrix-vector multiply = 2n^2 - n operations
            # Normalization adds ~2n operations
            # Total per iteration ≈ 2n^2 + n operations
            ops_per_iteration = 2 * n * n + n
            flops = ops_per_iteration / iter_duration if iter_duration > 0 else 0

            # Memory bandwidth (theoretical)
            # Read: A (n^2 elements) + x (n elements)
            # Write: x_new (n elements)
            # Total: (n^2 + 2n) elements
            bytes_transferred = (n * n + 2 * n) * dtype_bytes
            bandwidth_gbps = (
                (bytes_transferred / iter_duration / 1e9) if iter_duration > 0 else 0
            )

            # Check convergence using precision-aware criteria
            if is_converged and not converged:
                converged = True
                convergence_iteration = iteration

            # Check IEEE754 precision threshold (for backward compatibility)
            if ieee754_threshold is not None and relative_error < ieee754_threshold:
                if not threshold_reached:
                    threshold_reached = True
                    threshold_iteration = iteration

            # Store iteration data
            trace.append(
                {
                    "iteration": iteration,
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

            # Update eigenvalue_old for next iteration
            eigenvalue_old = eigenvalue

            # Stop if precision-aware convergence achieved
            if converged and convergence_iteration == iteration:
                break

            # Also stop if IEEE754 threshold is reached (legacy behavior)
            if threshold_reached and threshold_iteration == iteration:
                break

        # Calculate summary statistics
        total_time = time.perf_counter() - start_time
        total_iterations = len(trace)
        final_error = trace[-1]["relative_error"] if trace else float("nan")

        # Time to reach error thresholds
        time_to_1e3 = self._time_to_error(trace, 1e-3)
        time_to_1e6 = self._time_to_error(trace, 1e-6)
        time_to_1e9 = self._time_to_error(trace, 1e-9)

        # Average/peak performance
        flops_values = [
            t["theoretical_flops"] for t in trace if t["theoretical_flops"] > 0
        ]
        bandwidth_values = [
            t["theoretical_bandwidth_gbps"]
            for t in trace
            if t["theoretical_bandwidth_gbps"] > 0
        ]

        avg_flops = np.mean(flops_values) if flops_values else 0
        peak_flops = np.max(flops_values) if flops_values else 0
        avg_bandwidth = np.mean(bandwidth_values) if bandwidth_values else 0
        peak_bandwidth = np.max(bandwidth_values) if bandwidth_values else 0

        # Build complete trace document
        trace_document = {
            "metadata": {
                "precision": precision_name,
                "dtype": str(dtype),
                "dtype_bytes": dtype_bytes,
                "condition_number": float(self.condition_number),
                "matrix_size": self.matrix_size,
                "true_eigenvalue": float(self.true_eigenvalue),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "converged": converged,
                "convergence_iteration": convergence_iteration,
                "final_error": float(final_error),
                "tolerance": tol,
                "max_iterations": max_iter,
                "ieee754_threshold": ieee754_threshold,
                "threshold_reached": threshold_reached,
                "threshold_iteration": threshold_iteration,
            },
            "trace": trace,
            "summary": {
                "total_iterations": total_iterations,
                "total_time_seconds": total_time,
                "time_to_1e3_error": time_to_1e3,
                "time_to_1e6_error": time_to_1e6,
                "time_to_1e9_error": time_to_1e9,
                "avg_flops": float(avg_flops),
                "peak_flops": float(peak_flops),
                "avg_bandwidth_gbps": float(avg_bandwidth),
                "peak_bandwidth_gbps": float(peak_bandwidth),
                "total_ops": sum(t["ops_count"] for t in trace),
                "total_bytes": sum(t["bytes_transferred"] for t in trace),
            },
        }

        return trace_document

    def _time_to_error(
        self, trace: List[Dict], error_threshold: float
    ) -> Optional[float]:
        """
        Find time to reach a specific error threshold.

        Args:
            trace: Execution trace
            error_threshold: Target error threshold

        Returns:
            Time in seconds, or None if threshold not reached
        """
        for t in trace:
            if t["relative_error"] <= error_threshold:
                return float(t["cumulative_time"])
        return None

    def _check_convergence(
        self,
        A: np.ndarray,
        x: np.ndarray,
        eigenvalue: float,
        eigenvalue_old: float,
        precision_name: str,
    ) -> tuple[bool, float]:
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
        tol_config = self.PRECISION_TOLERANCES.get(
            precision_name, self.PRECISION_TOLERANCES["FP64"]
        )

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

    def save_trace(self, trace: Dict, output_path: str):
        """
        Save trace to JSON file.

        Args:
            trace: Trace document
            output_path: File path for JSON output
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, "w") as f:
            json.dump(trace, f, indent=2)

        print(f"✓ Trace saved: {output_path}")
        print(f"  - Iterations: {trace['summary']['total_iterations']}")
        print(f"  - Time: {trace['summary']['total_time_seconds']:.4f}s")
        print(f"  - Final error: {trace['metadata']['final_error']:.2e}")
        print(f"  - Avg FLOPS: {trace['summary']['avg_flops']/1e6:.2f} MFLOPS")


def main():
    """
    Test the instrumented tracer.
    """
    print("=" * 70)
    print("INSTRUMENTED POWER METHOD TRACER - TEST")
    print("=" * 70)

    # Test single configuration
    tracer = PowerMethodTracer(matrix_size=1000, condition_number=100)

    print("\nRunning FP32 trace...")
    trace = tracer.run(
        precision_name="FP32", dtype=np.float32, simulate_fp8_flag=False, max_iter=500
    )

    # Save test trace
    output_path = "algorithms/power_method/traces/test_fp32_cond100.json"
    tracer.save_trace(trace, output_path)

    print("\n" + "=" * 70)
    print("Test complete! Trace saved.")
    print("=" * 70)


if __name__ == "__main__":
    main()
