"""
Shared pytest fixtures for precision-lens tests.
"""
import pytest
import numpy as np
import sys
import os

# Add algorithms directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'algorithms', 'power_method'))


@pytest.fixture
def simple_matrix():
    """Simple 3x3 matrix with known eigenvalues."""
    # Diagonal matrix - eigenvalues are on diagonal
    return np.array([
        [3.0, 0.0, 0.0],
        [0.0, 2.0, 0.0],
        [0.0, 0.0, 1.0]
    ], dtype=np.float64)


@pytest.fixture
def well_conditioned_matrix():
    """Well-conditioned 5x5 matrix for testing."""
    np.random.seed(42)
    n = 5
    # Create symmetric positive definite matrix with condition number ~10
    Q, _ = np.linalg.qr(np.random.randn(n, n))
    eigenvalues = np.array([10, 8, 6, 4, 2])
    return Q @ np.diag(eigenvalues) @ Q.T


@pytest.fixture
def ill_conditioned_matrix():
    """Ill-conditioned matrix with high condition number."""
    np.random.seed(123)
    n = 5
    Q, _ = np.linalg.qr(np.random.randn(n, n))
    eigenvalues = np.array([1000, 100, 10, 5, 1])
    return Q @ np.diag(eigenvalues) @ Q.T


@pytest.fixture
def sample_trace_data():
    """Sample trace data for testing time_to_error functionality."""
    return [
        {'iteration': 0, 'relative_error': 1.0, 'cumulative_time': 0.001, 'eigenvalue': 5.0},
        {'iteration': 1, 'relative_error': 0.5, 'cumulative_time': 0.002, 'eigenvalue': 7.5},
        {'iteration': 2, 'relative_error': 0.01, 'cumulative_time': 0.003, 'eigenvalue': 9.9},
        {'iteration': 3, 'relative_error': 0.001, 'cumulative_time': 0.004, 'eigenvalue': 9.99},
        {'iteration': 4, 'relative_error': 1e-6, 'cumulative_time': 0.005, 'eigenvalue': 9.999999},
        {'iteration': 5, 'relative_error': 1e-9, 'cumulative_time': 0.006, 'eigenvalue': 9.9999999999},
    ]


@pytest.fixture(autouse=True)
def reset_random_seed():
    """Reset numpy random seed before each test for reproducibility."""
    np.random.seed(42)
