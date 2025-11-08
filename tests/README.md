# Test Suite for PrecisionLens

This directory contains comprehensive unit tests for the PrecisionLens project, covering both Python backend algorithms and JavaScript frontend utilities.

## Test Statistics

- **Total Tests**: 72 Python tests + extensive JavaScript test coverage
- **Python Test Coverage**: 100% pass rate
- **Test Files**:
  - `conftest.py` - Shared fixtures and test configuration
  - `test_study.py` - Tests for core algorithms (simulate_fp8, power_method, create_test_matrix)
  - `test_instrumented.py` - Tests for PowerMethodTracer and trace generation
  - `web/tests/dashboard.test.js` - Tests for frontend utilities

## Running Tests

### Python Tests

```bash
# Install dependencies
pip install -r requirements.txt

# Run all tests
pytest tests/

# Run with verbose output
pytest tests/ -v

# Run specific test file
pytest tests/test_study.py

# Run with coverage
pytest tests/ --cov=algorithms.power_method
```

### JavaScript Tests

```bash
# Install dependencies
cd web
npm install

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Test Coverage by Module

### Python Backend Tests (72 tests)

#### 1. `test_study.py` (37 tests)

**simulate_fp8() Tests (14 tests)**
- ✓ Zero handling (positive, negative, very small)
- ✓ Sign preservation (positive, negative, mixed)
- ✓ Quantization correctness (discrete levels, precision loss)
- ✓ Edge cases (NaN, Infinity, threshold boundaries)
- ✓ Data type conversion and array shape preservation

**power_method() Tests (12 tests)**
- ✓ Convergence accuracy (FP64, FP32, FP16, FP8)
- ✓ Diagonal and well-conditioned matrices
- ✓ Ill-conditioned matrices (high condition number)
- ✓ Tolerance and max iteration limits
- ✓ Zero norm handling (singular matrices)
- ✓ Return type validation

**create_test_matrix() Tests (11 tests)**
- ✓ Matrix symmetry verification
- ✓ Positive definite property
- ✓ Condition number accuracy
- ✓ Eigenvalue bounds validation
- ✓ Edge cases (n=1, very large/small condition numbers)
- ✓ Reproducibility with seed

#### 2. `test_instrumented.py` (35 tests)

**PowerMethodTracer Initialization (5 tests)**
- ✓ Default and custom parameters
- ✓ Matrix generation validation
- ✓ True eigenvalue computation

**PowerMethodTracer.run() Tests (18 tests)**
- ✓ Multiple precision modes (FP64, FP32, FP16, FP8)
- ✓ Trace data structure validation
- ✓ **Critical**: Division by zero prevention in FLOPS calculations
- ✓ **Critical**: Division by zero prevention in bandwidth calculations
- ✓ Relative error calculation accuracy
- ✓ Performance metrics (ops count, bytes transferred)
- ✓ Convergence detection
- ✓ Iteration limits

**_time_to_error() Tests (7 tests)**
- ✓ Threshold detection (1e-3, 1e-6, 1e-9)
- ✓ Threshold not reached (returns None)
- ✓ Empty trace handling
- ✓ First iteration matches

**save_trace() Tests (5 tests)**
- ✓ JSON file creation
- ✓ Directory creation
- ✓ NumPy type serialization
- ✓ Data preservation

### JavaScript Frontend Tests

**formatError() Tests**
- ✓ NaN and Infinity handling
- ✓ Zero (positive and negative)
- ✓ Scientific notation for very small numbers (< 1e-9)
- ✓ Fixed-point formatting for various ranges
- ✓ Boundary conditions

**formatFlops() Tests**
- ✓ Unit conversion (K/M/G)
- ✓ Null/undefined handling
- ✓ Decimal precision
- ✓ Boundary conditions

**updateComparison() Calculations**
- ✓ Time per iteration calculation
- ✓ **Critical**: Division by zero detection
- ✓ Multiple precision comparison

**generateInsights() Calculations**
- ✓ Speedup ratio calculations
- ✓ **Critical**: Division by zero in speedup calculations
- ✓ Error threshold comparisons
- ✓ Convergence analysis

**Edge Cases and Error Handling**
- ✓ Numeric stability (floating-point precision)
- ✓ Overflow/underflow detection
- ✓ Array and object safety
- ✓ Missing data handling

## Critical Bug Prevention

These tests specifically prevent the following potential issues identified in the codebase analysis:

### Python Issues Prevented

1. **Line 102 (instrumented.py)**: Division by zero when `true_eigenvalue` is zero or very small
2. **Line 120 (instrumented.py)**: Division by zero in FLOPS calculation when `iter_duration` is 0
3. **Line 127 (instrumented.py)**: Division by zero in bandwidth calculation
4. **Line 51 (study.py)**: Precision loss in FP8 quantization
5. **Line 103 (study.py)**: Zero norm handling in power method

### JavaScript Issues Prevented

1. **Line 389 (dashboard.js)**: Division by zero in time per iteration calculation
2. **Line 417-419 (dashboard.js)**: Division by zero in speedup calculations
3. **Line 486-492 (dashboard.js)**: NaN/Infinity handling in formatError()
4. **Line 495 (dashboard.js)**: Null/undefined handling in formatFlops()

## Test Fixtures

### Python Fixtures (conftest.py)

- `simple_matrix` - 3×3 diagonal matrix with known eigenvalues
- `well_conditioned_matrix` - 5×5 matrix with condition number ~10
- `ill_conditioned_matrix` - 5×5 matrix with condition number ~1000
- `sample_trace_data` - Mock trace data for testing time_to_error
- `reset_random_seed` - Ensures reproducibility (auto-used)

## CI/CD Integration

These tests are designed to be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Python Tests
  run: |
    pip install -r requirements.txt
    pytest tests/ -v

- name: Run JavaScript Tests
  run: |
    cd web
    npm install
    npm test
```

## Future Enhancements

Potential areas for additional testing:

1. **Integration Tests**: Test complete trace generation pipeline
2. **Performance Tests**: Benchmark critical functions
3. **Property-Based Tests**: Use hypothesis for generative testing
4. **Visual Regression Tests**: Test dashboard rendering
5. **E2E Tests**: Test complete user workflows

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure tests cover edge cases (NaN, Infinity, zero, null)
3. Test division by zero scenarios
4. Verify error handling
5. Run full test suite before committing

## Test Maintenance

- Tests use seeded random values for reproducibility
- Fixtures are shared to avoid duplication
- Test names clearly describe what they test
- Comments explain complex test scenarios
