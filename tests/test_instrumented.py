"""
Unit tests for algorithms/power_method/instrumented.py

Tests cover:
- PowerMethodTracer initialization
- Trace generation and metric calculations
- Division by zero handling in FLOPS/bandwidth calculations
- _time_to_error() threshold detection
- JSON serialization and file I/O
"""
import pytest
import numpy as np
import json
import tempfile
import os
from instrumented import PowerMethodTracer


class TestPowerMethodTracerInit:
    """Tests for PowerMethodTracer initialization."""

    def test_initialization_defaults(self):
        """Test initialization with default parameters."""
        tracer = PowerMethodTracer()
        assert tracer.matrix_size == 50
        assert tracer.condition_number == 100.0
        assert tracer.matrix.shape == (50, 50)
        assert tracer.true_eigenvalue > 0

    def test_initialization_custom_size(self):
        """Test initialization with custom matrix size."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=50)
        assert tracer.matrix_size == 10
        assert tracer.matrix.shape == (10, 10)

    def test_initialization_custom_condition(self):
        """Test initialization with custom condition number."""
        tracer = PowerMethodTracer(matrix_size=20, condition_number=1000)
        assert tracer.condition_number == 1000
        # Verify condition number is approximately correct
        eigenvalues = np.linalg.eigvalsh(tracer.matrix)
        actual_condition = np.max(eigenvalues) / np.min(eigenvalues)
        assert abs(actual_condition - 1000) / 1000 < 0.2  # Within 20%

    def test_true_eigenvalue_computed(self):
        """Test that true eigenvalue is computed correctly."""
        tracer = PowerMethodTracer(matrix_size=15, condition_number=100)
        # True eigenvalue should be the max eigenvalue of the matrix
        expected_true = np.max(np.linalg.eigvalsh(tracer.matrix))
        assert abs(tracer.true_eigenvalue - expected_true) < 1e-10

    def test_matrix_symmetry(self):
        """Test that generated matrix is symmetric."""
        tracer = PowerMethodTracer(matrix_size=20, condition_number=50)
        assert np.allclose(tracer.matrix, tracer.matrix.T)


class TestPowerMethodTracerRun:
    """Tests for PowerMethodTracer.run() method."""

    def test_run_basic_fp64(self):
        """Test basic run with FP64 precision."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=100)

        # Verify trace structure
        assert 'metadata' in trace
        assert 'trace' in trace
        assert 'summary' in trace

        # Verify metadata
        assert trace['metadata']['precision'] == 'FP64'
        assert trace['metadata']['matrix_size'] == 10
        assert trace['metadata']['condition_number'] == 10.0

        # Verify trace is non-empty
        assert len(trace['trace']) > 0

    def test_run_fp32(self):
        """Test run with FP32 precision."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP32', np.float32, max_iter=100)

        assert trace['metadata']['precision'] == 'FP32'
        assert trace['metadata']['dtype_bytes'] == 4
        assert len(trace['trace']) > 0

    def test_run_fp16(self):
        """Test run with FP16 precision."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP16', np.float16, max_iter=100)

        assert trace['metadata']['precision'] == 'FP16'
        assert trace['metadata']['dtype_bytes'] == 2
        assert len(trace['trace']) > 0

    def test_run_fp8_simulation(self):
        """Test run with FP8 simulation."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP8', np.float32, simulate_fp8_flag=True, max_iter=100)

        assert trace['metadata']['precision'] == 'FP8'
        assert trace['metadata']['dtype_bytes'] == 1  # FP8 should be 1 byte
        assert len(trace['trace']) > 0

    def test_trace_iteration_data_structure(self):
        """Test that each iteration has required fields."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=50)

        required_fields = [
            'iteration', 'wall_time', 'cumulative_time', 'eigenvalue',
            'relative_error', 'vector_norm', 'theoretical_flops',
            'theoretical_bandwidth_gbps', 'ops_count', 'bytes_transferred'
        ]

        for iteration_data in trace['trace']:
            for field in required_fields:
                assert field in iteration_data

    def test_relative_error_calculation(self):
        """Test that relative error is calculated correctly."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=100)

        for iteration_data in trace['trace']:
            eigenvalue = iteration_data['eigenvalue']
            relative_error = iteration_data['relative_error']
            expected_error = abs(eigenvalue - tracer.true_eigenvalue) / abs(tracer.true_eigenvalue)
            assert abs(relative_error - expected_error) < 1e-10

    def test_flops_calculation_no_division_by_zero(self):
        """Test that FLOPS calculation handles zero duration."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=50)

        # All FLOPS values should be non-negative (zero is acceptable if duration is 0)
        for iteration_data in trace['trace']:
            flops = iteration_data['theoretical_flops']
            assert flops >= 0
            assert not np.isnan(flops)
            assert not np.isinf(flops)

    def test_bandwidth_calculation_no_division_by_zero(self):
        """Test that bandwidth calculation handles zero duration."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=50)

        # All bandwidth values should be non-negative
        for iteration_data in trace['trace']:
            bandwidth = iteration_data['theoretical_bandwidth_gbps']
            assert bandwidth >= 0
            assert not np.isnan(bandwidth)
            assert not np.isinf(bandwidth)

    def test_cumulative_time_monotonic(self):
        """Test that cumulative time is monotonically increasing."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=50)

        cumulative_times = [t['cumulative_time'] for t in trace['trace']]
        for i in range(1, len(cumulative_times)):
            assert cumulative_times[i] >= cumulative_times[i-1]

    def test_convergence_detection(self):
        """Test that convergence is properly detected."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=500, tol=1e-6)

        # For well-conditioned matrix, should converge
        if trace['metadata']['converged']:
            assert trace['metadata']['convergence_iteration'] is not None
            assert trace['metadata']['convergence_iteration'] < 500

    def test_max_iterations_respected(self):
        """Test that max_iter limit is respected."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        max_iter = 30
        trace = tracer.run('FP64', np.float64, max_iter=max_iter)

        assert len(trace['trace']) <= max_iter
        assert trace['summary']['total_iterations'] <= max_iter

    def test_summary_statistics(self):
        """Test that summary statistics are computed correctly."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=50)

        summary = trace['summary']

        # Check required summary fields
        assert 'total_iterations' in summary
        assert 'total_time_seconds' in summary
        assert 'avg_flops' in summary
        assert 'peak_flops' in summary
        assert 'avg_bandwidth_gbps' in summary
        assert 'peak_bandwidth_gbps' in summary

        # Verify total iterations matches trace length
        assert summary['total_iterations'] == len(trace['trace'])

        # Verify time values are reasonable
        assert summary['total_time_seconds'] > 0
        assert summary['total_time_seconds'] < 100  # Should not take 100+ seconds

    def test_ops_count_correct(self):
        """Test that operations count is calculated correctly."""
        n = 15
        tracer = PowerMethodTracer(matrix_size=n, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=10)

        expected_ops = 2 * n * n + n
        for iteration_data in trace['trace']:
            assert iteration_data['ops_count'] == expected_ops

    def test_bytes_transferred_correct(self):
        """Test that bytes transferred is calculated correctly."""
        n = 20
        tracer = PowerMethodTracer(matrix_size=n, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=10)

        # FP64 is 8 bytes per element
        expected_bytes = (n * n + 2 * n) * 8
        for iteration_data in trace['trace']:
            assert iteration_data['bytes_transferred'] == expected_bytes

    def test_bytes_transferred_fp32(self):
        """Test bytes transferred for FP32."""
        n = 20
        tracer = PowerMethodTracer(matrix_size=n, condition_number=10)
        trace = tracer.run('FP32', np.float32, max_iter=10)

        # FP32 is 4 bytes per element
        expected_bytes = (n * n + 2 * n) * 4
        for iteration_data in trace['trace']:
            assert iteration_data['bytes_transferred'] == expected_bytes

    def test_bytes_transferred_fp8(self):
        """Test bytes transferred for simulated FP8."""
        n = 20
        tracer = PowerMethodTracer(matrix_size=n, condition_number=10)
        trace = tracer.run('FP8', np.float32, simulate_fp8_flag=True, max_iter=10)

        # FP8 is 1 byte per element
        expected_bytes = (n * n + 2 * n) * 1
        for iteration_data in trace['trace']:
            assert iteration_data['bytes_transferred'] == expected_bytes

    def test_final_error_in_metadata(self):
        """Test that final error is stored in metadata."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=100)

        final_error = trace['metadata']['final_error']
        last_trace_error = trace['trace'][-1]['relative_error']

        assert abs(final_error - last_trace_error) < 1e-10

    def test_zero_true_eigenvalue_handling(self):
        """Test handling when true eigenvalue is very small (edge case)."""
        # This is a pathological case - create a matrix with very small eigenvalues
        # Not testing this directly as create_test_matrix ensures positive eigenvalues
        # But we can test relative error doesn't become inf/nan
        tracer = PowerMethodTracer(matrix_size=5, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=50)

        for iteration_data in trace['trace']:
            assert not np.isinf(iteration_data['relative_error'])
            # NaN is possible if eigenvalue estimate is exactly true_eigenvalue


class TestTimeToError:
    """Tests for _time_to_error() method."""

    def test_time_to_error_threshold_reached(self, sample_trace_data):
        """Test finding time when error threshold is reached."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)

        # Test 1e-3 threshold
        time = tracer._time_to_error(sample_trace_data, 1e-3)
        assert time == 0.004  # iteration 3 reaches 0.001

    def test_time_to_error_1e6_threshold(self, sample_trace_data):
        """Test finding time for 1e-6 threshold."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        time = tracer._time_to_error(sample_trace_data, 1e-6)
        assert time == 0.005  # iteration 4 reaches 1e-6

    def test_time_to_error_1e9_threshold(self, sample_trace_data):
        """Test finding time for 1e-9 threshold."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        time = tracer._time_to_error(sample_trace_data, 1e-9)
        assert time == 0.006  # iteration 5 reaches 1e-9

    def test_time_to_error_threshold_not_reached(self, sample_trace_data):
        """Test that None is returned when threshold is not reached."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        time = tracer._time_to_error(sample_trace_data, 1e-15)
        assert time is None

    def test_time_to_error_empty_trace(self):
        """Test handling of empty trace."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        time = tracer._time_to_error([], 1e-3)
        assert time is None

    def test_time_to_error_first_iteration(self):
        """Test when first iteration already meets threshold."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        trace = [
            {'iteration': 0, 'relative_error': 1e-10, 'cumulative_time': 0.001}
        ]
        time = tracer._time_to_error(trace, 1e-6)
        assert time == 0.001

    def test_time_to_error_exact_match(self, sample_trace_data):
        """Test when error exactly matches threshold."""
        tracer = PowerMethodTracer(matrix_size=10, condition_number=10)
        time = tracer._time_to_error(sample_trace_data, 1e-6)
        # Should find the iteration where error is exactly 1e-6
        assert time is not None


class TestSaveTrace:
    """Tests for save_trace() method."""

    def test_save_trace_creates_file(self):
        """Test that trace is saved to JSON file."""
        tracer = PowerMethodTracer(matrix_size=5, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=10)

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'test_trace.json')
            tracer.save_trace(trace, output_path)

            # Verify file exists
            assert os.path.exists(output_path)

    def test_save_trace_json_valid(self):
        """Test that saved JSON is valid and loadable."""
        tracer = PowerMethodTracer(matrix_size=5, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=10)

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'test_trace.json')
            tracer.save_trace(trace, output_path)

            # Load and verify
            with open(output_path, 'r') as f:
                loaded_trace = json.load(f)

            assert loaded_trace['metadata']['precision'] == 'FP64'
            assert len(loaded_trace['trace']) == len(trace['trace'])

    def test_save_trace_creates_directory(self):
        """Test that missing directories are created."""
        tracer = PowerMethodTracer(matrix_size=5, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=10)

        with tempfile.TemporaryDirectory() as tmpdir:
            # Use nested directory that doesn't exist
            output_path = os.path.join(tmpdir, 'subdir', 'nested', 'test_trace.json')
            tracer.save_trace(trace, output_path)

            # Verify file exists
            assert os.path.exists(output_path)

    def test_save_trace_numpy_types_serializable(self):
        """Test that numpy types are properly serialized to JSON."""
        tracer = PowerMethodTracer(matrix_size=5, condition_number=10)
        trace = tracer.run('FP64', np.float64, max_iter=10)

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'test_trace.json')
            tracer.save_trace(trace, output_path)

            # Load and verify all numeric types are Python types
            with open(output_path, 'r') as f:
                loaded_trace = json.load(f)

            # Check that numeric values are proper JSON types
            assert isinstance(loaded_trace['metadata']['condition_number'], (int, float))
            assert isinstance(loaded_trace['summary']['total_iterations'], int)
            assert isinstance(loaded_trace['summary']['total_time_seconds'], float)

    def test_save_trace_preserves_data(self):
        """Test that all trace data is preserved in saved file."""
        tracer = PowerMethodTracer(matrix_size=5, condition_number=10)
        trace = tracer.run('FP32', np.float32, max_iter=10)

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = os.path.join(tmpdir, 'test_trace.json')
            tracer.save_trace(trace, output_path)

            with open(output_path, 'r') as f:
                loaded_trace = json.load(f)

            # Verify key data is preserved
            assert loaded_trace['metadata']['matrix_size'] == trace['metadata']['matrix_size']
            assert loaded_trace['summary']['total_iterations'] == trace['summary']['total_iterations']
            assert len(loaded_trace['trace']) == len(trace['trace'])

            # Verify a few iteration data points
            for i in [0, -1]:
                assert loaded_trace['trace'][i]['iteration'] == trace['trace'][i]['iteration']
                assert abs(loaded_trace['trace'][i]['eigenvalue'] - trace['trace'][i]['eigenvalue']) < 1e-6
