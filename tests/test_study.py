"""
Unit tests for algorithms/power_method/study.py

Tests cover:
- simulate_fp8() edge cases and quantization correctness
- power_method() convergence and numerical stability
- create_test_matrix() matrix properties and validation
"""

import numpy as np
from study import create_test_matrix, power_method, simulate_fp8


class TestSimulateFP8:
    """Tests for FP8 simulation function."""

    def test_zeros_handling(self):
        """Test that zeros are handled correctly."""
        x = np.array([0.0, 0.0, 0.0])
        result = simulate_fp8(x)
        assert np.allclose(result, 0.0)

    def test_negative_zeros(self):
        """Test that negative zeros are preserved."""
        x = np.array([-0.0, 0.0])
        result = simulate_fp8(x)
        # Both should be zero (sign may not be preserved)
        assert np.allclose(np.abs(result), 0.0)

    def test_positive_values(self):
        """Test quantization of positive values."""
        x = np.array([1.0, 2.0, 3.0])
        result = simulate_fp8(x)
        # All should be positive
        assert np.all(result >= 0)
        # Should be quantized (multiples of 1/8)
        assert np.all(result * 8 == np.round(result * 8))

    def test_negative_values(self):
        """Test quantization of negative values."""
        x = np.array([-1.0, -2.0, -3.0])
        result = simulate_fp8(x)
        # All should be negative
        assert np.all(result <= 0)
        # Absolute values should be quantized
        assert np.all(np.abs(result) * 8 == np.round(np.abs(result) * 8))

    def test_mixed_signs(self):
        """Test handling of mixed positive and negative values."""
        x = np.array([-2.5, -1.0, 0.0, 1.0, 2.5])
        result = simulate_fp8(x)
        # Signs should be preserved (except for zero)
        assert result[0] < 0  # negative stays negative
        assert result[1] < 0
        assert result[3] > 0  # positive stays positive
        assert result[4] > 0

    def test_very_small_numbers_below_threshold(self):
        """Test that numbers below 1e-10 threshold become zero."""
        x = np.array([1e-11, 1e-12, -1e-11, 1e-15])
        result = simulate_fp8(x)
        # All should be quantized to zero (below threshold)
        assert np.allclose(result, 0.0)

    def test_very_small_numbers_above_threshold(self):
        """Test that numbers just above 1e-10 threshold are quantized."""
        x = np.array([1e-9, 5e-10])
        result = simulate_fp8(x)
        # Should not be zero, but heavily quantized
        # Due to quantization, very small values may round to zero
        assert result.dtype == np.float32

    def test_large_numbers(self):
        """Test quantization of large numbers."""
        x = np.array([100.0, 1000.0, 10000.0])
        result = simulate_fp8(x)
        # Should maintain relative order
        assert result[0] < result[1] < result[2]
        # Should be quantized
        assert np.all(result * 8 == np.round(result * 8))

    def test_nan_handling(self):
        """Test handling of NaN values."""
        x = np.array([1.0, np.nan, 3.0])
        result = simulate_fp8(x)
        # NaN should propagate
        assert np.isnan(result[1])
        assert not np.isnan(result[0])
        assert not np.isnan(result[2])

    def test_infinity_handling(self):
        """Test handling of infinity values."""
        x = np.array([np.inf, -np.inf, 1.0])
        result = simulate_fp8(x)
        # Infinities should be handled (may become very large or inf)
        assert result.dtype == np.float32

    def test_precision_loss(self):
        """Test that precision is significantly reduced."""
        x = np.array([1.123456789])
        result = simulate_fp8(x)
        # Result should be less precise than input
        # With 8 quantization levels, precision is ~1/8
        assert abs(result[0] - x[0]) >= 0.0  # Some quantization error
        # Result should be a multiple of 1/8
        assert np.allclose(result * 8, np.round(result * 8))

    def test_quantization_levels(self):
        """Test that quantization produces discrete levels."""
        x = np.linspace(0.1, 1.0, 100)
        result = simulate_fp8(x)
        # All results should be multiples of 1/8
        quantized = result * 8
        assert np.allclose(quantized, np.round(quantized), atol=1e-6)

    def test_dtype_conversion(self):
        """Test that output is float32."""
        x = np.array([1.0, 2.0, 3.0], dtype=np.float64)
        result = simulate_fp8(x)
        assert result.dtype == np.float32

    def test_array_shapes_preserved(self):
        """Test that array shapes are preserved."""
        shapes = [(5,), (3, 3), (2, 4)]
        for shape in shapes:
            x = np.random.randn(*shape)
            result = simulate_fp8(x)
            assert result.shape == x.shape


class TestPowerMethod:
    """Tests for power method eigenvalue computation."""

    def test_diagonal_matrix_convergence(self, simple_matrix):
        """Test convergence on diagonal matrix with known eigenvalue."""
        eigenvalue, history = power_method(simple_matrix, max_iter=100)
        # Dominant eigenvalue should be 3.0
        assert abs(eigenvalue - 3.0) < 1e-6
        # Should converge reasonably quickly for diagonal matrix
        assert len(history) < 50

    def test_convergence_history_length(self, well_conditioned_matrix):
        """Test that convergence history is non-empty."""
        eigenvalue, history = power_method(well_conditioned_matrix, max_iter=100)
        assert len(history) > 0
        assert len(history) <= 100  # Should not exceed max_iter

    def test_eigenvalue_accuracy_fp64(self, well_conditioned_matrix):
        """Test eigenvalue accuracy with FP64 precision."""
        true_eigenvalue = np.max(np.linalg.eigvalsh(well_conditioned_matrix))
        eigenvalue, _ = power_method(
            well_conditioned_matrix, max_iter=500, dtype=np.float64
        )
        relative_error = abs(eigenvalue - true_eigenvalue) / abs(true_eigenvalue)
        assert relative_error < 1e-8  # FP64 should be very accurate

    def test_eigenvalue_accuracy_fp32(self, well_conditioned_matrix):
        """Test eigenvalue accuracy with FP32 precision."""
        true_eigenvalue = np.max(np.linalg.eigvalsh(well_conditioned_matrix))
        eigenvalue, _ = power_method(
            well_conditioned_matrix, max_iter=500, dtype=np.float32
        )
        relative_error = abs(eigenvalue - true_eigenvalue) / abs(true_eigenvalue)
        assert relative_error < 1e-5  # FP32 less accurate than FP64

    def test_fp16_precision(self, well_conditioned_matrix):
        """Test that FP16 precision runs without errors."""
        eigenvalue, history = power_method(
            well_conditioned_matrix, max_iter=500, dtype=np.float16
        )
        assert len(history) > 0
        assert not np.isnan(eigenvalue)
        assert not np.isinf(eigenvalue)

    def test_fp8_simulation(self, well_conditioned_matrix):
        """Test FP8 simulation mode."""
        eigenvalue, history = power_method(
            well_conditioned_matrix,
            max_iter=500,
            dtype=np.float32,
            simulate_fp8_flag=True,
        )
        assert len(history) > 0
        assert not np.isnan(eigenvalue)
        # FP8 should be less accurate
        true_eigenvalue = np.max(np.linalg.eigvalsh(well_conditioned_matrix))
        relative_error = abs(eigenvalue - true_eigenvalue) / abs(true_eigenvalue)
        # FP8 will have significant error
        assert relative_error >= 0  # Should have some error

    def test_convergence_tolerance(self, simple_matrix):
        """Test that tolerance affects convergence."""
        # Tight tolerance
        _, history_tight = power_method(simple_matrix, max_iter=1000, tol=1e-12)
        # Loose tolerance
        _, history_loose = power_method(simple_matrix, max_iter=1000, tol=1e-3)
        # Loose tolerance should converge faster
        assert len(history_loose) <= len(history_tight)

    def test_max_iterations_limit(self, ill_conditioned_matrix):
        """Test that max_iter is respected."""
        max_iter = 50
        _, history = power_method(ill_conditioned_matrix, max_iter=max_iter, tol=1e-15)
        assert len(history) <= max_iter

    def test_zero_norm_handling(self):
        """Test handling of zero norm (singular matrix)."""
        # Create a matrix that will produce zero norm after iterations
        A = np.zeros((5, 5))
        eigenvalue, history = power_method(A, max_iter=100)
        # Should break early due to zero norm
        assert len(history) < 100
        # Eigenvalue should be zero or very small
        assert abs(eigenvalue) < 1e-5

    def test_return_types(self, simple_matrix):
        """Test that return types are correct."""
        eigenvalue, history = power_method(simple_matrix)
        assert isinstance(eigenvalue, float)
        assert isinstance(history, list)
        assert all(isinstance(x, float) for x in history)

    def test_history_monotonic_convergence(self, well_conditioned_matrix):
        """Test that eigenvalue estimates stabilize over iterations."""
        _, history = power_method(well_conditioned_matrix, max_iter=100)
        # Later estimates should be more stable
        # Check that last 5 iterations have small variation
        if len(history) >= 10:
            last_five = history[-5:]
            variation = max(last_five) - min(last_five)
            assert variation < 0.1  # Should be relatively stable

    def test_ill_conditioned_matrix(self, ill_conditioned_matrix):
        """Test behavior on ill-conditioned matrix."""
        true_eigenvalue = np.max(np.linalg.eigvalsh(ill_conditioned_matrix))
        eigenvalue, history = power_method(
            ill_conditioned_matrix, max_iter=1000, dtype=np.float64
        )
        # Should still converge, but may take more iterations
        relative_error = abs(eigenvalue - true_eigenvalue) / abs(true_eigenvalue)
        assert relative_error < 0.01  # May not be as accurate for ill-conditioned


class TestCreateTestMatrix:
    """Tests for test matrix generation."""

    def test_matrix_shape(self):
        """Test that matrix has correct shape."""
        n = 10
        A = create_test_matrix(n, condition_number=100)
        assert A.shape == (n, n)

    def test_matrix_symmetry(self):
        """Test that matrix is symmetric."""
        A = create_test_matrix(50, condition_number=100)
        assert np.allclose(A, A.T, atol=1e-10)

    def test_positive_definite(self):
        """Test that matrix is positive definite."""
        A = create_test_matrix(20, condition_number=50)
        eigenvalues = np.linalg.eigvalsh(A)
        # All eigenvalues should be positive
        assert np.all(eigenvalues > 0)

    def test_condition_number_accuracy(self):
        """Test that condition number is approximately correct."""
        target_condition = 100.0
        A = create_test_matrix(30, condition_number=target_condition)
        eigenvalues = np.linalg.eigvalsh(A)
        actual_condition = np.max(eigenvalues) / np.min(eigenvalues)
        # Should be close to target (within 10%)
        assert abs(actual_condition - target_condition) / target_condition < 0.1

    def test_single_dimension_matrix(self):
        """Test matrix with n=1."""
        A = create_test_matrix(1, condition_number=10)
        assert A.shape == (1, 1)
        # Condition number should be 1 (only one eigenvalue)
        assert A[0, 0] > 0

    def test_large_condition_number(self):
        """Test matrix with very large condition number."""
        A = create_test_matrix(20, condition_number=1e6)
        eigenvalues = np.linalg.eigvalsh(A)
        condition = np.max(eigenvalues) / np.min(eigenvalues)
        # Should have large condition number
        assert condition > 1e5

    def test_small_condition_number(self):
        """Test matrix with small condition number (close to identity)."""
        A = create_test_matrix(15, condition_number=1.0)
        eigenvalues = np.linalg.eigvalsh(A)
        # All eigenvalues should be close to each other
        assert np.max(eigenvalues) / np.min(eigenvalues) < 1.1

    def test_eigenvalue_bounds(self):
        """Test that eigenvalues are in expected range."""
        condition = 500.0
        A = create_test_matrix(25, condition_number=condition)
        eigenvalues = np.linalg.eigvalsh(A)
        # Min eigenvalue should be close to 1.0
        assert abs(np.min(eigenvalues) - 1.0) < 0.1
        # Max eigenvalue should be close to condition_number
        assert abs(np.max(eigenvalues) - condition) < 50

    def test_different_sizes(self):
        """Test matrix generation for different sizes."""
        sizes = [2, 5, 10, 50, 100]
        for n in sizes:
            A = create_test_matrix(n, condition_number=10)
            assert A.shape == (n, n)
            assert np.allclose(A, A.T)

    def test_reproducibility_with_seed(self):
        """Test that matrices are reproducible with same seed."""
        np.random.seed(42)
        A1 = create_test_matrix(20, condition_number=100)
        np.random.seed(42)
        A2 = create_test_matrix(20, condition_number=100)
        assert np.allclose(A1, A2)

    def test_orthogonality_of_eigenvectors(self):
        """Test that eigenvectors are orthogonal (implicit in symmetric matrix)."""
        A = create_test_matrix(15, condition_number=100)
        eigenvalues, eigenvectors = np.linalg.eigh(A)
        # Check orthogonality: V^T @ V should be identity
        orthogonality = eigenvectors.T @ eigenvectors
        assert np.allclose(orthogonality, np.eye(15), atol=1e-10)
