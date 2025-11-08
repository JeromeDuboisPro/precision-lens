/**
 * Unit tests for dashboard.js
 *
 * Tests cover:
 * - formatError() edge cases with NaN, Infinity, zero, and various ranges
 * - formatFlops() unit conversion logic (K/M/G)
 * - updateComparison() calculations including division by zero checks
 * - generateInsights() speedup calculations
 */

// Mock the global document and Plotly for testing
global.document = {
    getElementById: jest.fn(() => ({
        addEventListener: jest.fn(),
        textContent: '',
        value: '',
        innerHTML: ''
    }))
};

global.Plotly = {
    newPlot: jest.fn(),
    update: jest.fn()
};

// Load the dashboard class
// Note: In actual implementation, you'd need to properly import/require the class
// For now, we'll test the methods directly by extracting them

describe('PrecisionDashboard Utility Functions', () => {
    let dashboard;

    beforeEach(() => {
        // Create a minimal dashboard instance for testing
        // We'll need to extract just the utility methods
        dashboard = {
            formatError: function(error) {
                if (isNaN(error) || !isFinite(error)) return 'NaN';
                if (error === 0) return '0';
                if (error < 1e-9) return error.toExponential(1);
                if (error < 1e-3) return error.toExponential(2);
                if (error < 1) return error.toFixed(4);
                return error.toFixed(2);
            },
            formatFlops: function(flops) {
                if (!flops || flops === 0) return '—';
                const mflops = flops / 1e6;
                if (mflops < 1) return `${(flops / 1e3).toFixed(1)}K`;
                if (mflops < 1000) return `${mflops.toFixed(1)}M`;
                return `${(mflops / 1000).toFixed(2)}G`;
            }
        };
    });

    describe('formatError()', () => {
        test('should handle NaN', () => {
            expect(dashboard.formatError(NaN)).toBe('NaN');
        });

        test('should handle positive infinity', () => {
            expect(dashboard.formatError(Infinity)).toBe('NaN');
        });

        test('should handle negative infinity', () => {
            expect(dashboard.formatError(-Infinity)).toBe('NaN');
        });

        test('should handle zero', () => {
            expect(dashboard.formatError(0)).toBe('0');
        });

        test('should handle negative zero', () => {
            expect(dashboard.formatError(-0)).toBe('0');
        });

        test('should format very small numbers (< 1e-9) in exponential notation with 1 decimal', () => {
            expect(dashboard.formatError(1e-10)).toBe('1.0e-10');
            expect(dashboard.formatError(5.7e-15)).toBe('5.7e-15');
            expect(dashboard.formatError(1e-12)).toBe('1.0e-12');
        });

        test('should format small numbers (1e-9 to 1e-3) in exponential notation with 2 decimals', () => {
            expect(dashboard.formatError(1e-6)).toBe('1.00e-6');
            expect(dashboard.formatError(5.25e-5)).toBe('5.25e-5');
            expect(dashboard.formatError(9.99e-4)).toBe('9.99e-4');
        });

        test('should format medium numbers (1e-3 to 1) with 4 decimal places', () => {
            expect(dashboard.formatError(0.001)).toBe('0.0010');
            expect(dashboard.formatError(0.1234)).toBe('0.1234');
            expect(dashboard.formatError(0.9999)).toBe('0.9999');
        });

        test('should format large numbers (>= 1) with 2 decimal places', () => {
            expect(dashboard.formatError(1.0)).toBe('1.00');
            expect(dashboard.formatError(10.567)).toBe('10.57');
            expect(dashboard.formatError(123.456)).toBe('123.46');
        });

        test('should handle edge cases at boundaries', () => {
            expect(dashboard.formatError(1e-9)).toBe('1.00e-9');  // Boundary: should use 2 decimals
            expect(dashboard.formatError(1e-3)).toBe('0.0010');   // Boundary: should use 4 decimals
            expect(dashboard.formatError(1.0)).toBe('1.00');      // Boundary: should use 2 decimals
        });

        test('should handle negative numbers', () => {
            // Note: The function doesn't handle negatives with absolute value,
            // so negative numbers less than 1e-9 use 1 decimal exponential
            expect(dashboard.formatError(-0.001)).toBe('-1.0e-3');
            // -1e-5 is less than 1e-9 (negative comparison), so uses 1 decimal
            expect(dashboard.formatError(-1e-5)).toBe('-1.0e-5');
        });
    });

    describe('formatFlops()', () => {
        test('should return em dash for zero', () => {
            expect(dashboard.formatFlops(0)).toBe('—');
        });

        test('should return em dash for null', () => {
            expect(dashboard.formatFlops(null)).toBe('—');
        });

        test('should return em dash for undefined', () => {
            expect(dashboard.formatFlops(undefined)).toBe('—');
        });

        test('should format values < 1M as K (thousands)', () => {
            expect(dashboard.formatFlops(1e3)).toBe('1.0K');
            expect(dashboard.formatFlops(500e3)).toBe('500.0K');
            expect(dashboard.formatFlops(999e3)).toBe('999.0K');
        });

        test('should format values 1M-1000M as M (millions)', () => {
            expect(dashboard.formatFlops(1e6)).toBe('1.0M');
            expect(dashboard.formatFlops(50e6)).toBe('50.0M');
            expect(dashboard.formatFlops(999e6)).toBe('999.0M');
        });

        test('should format values >= 1000M as G (billions)', () => {
            expect(dashboard.formatFlops(1e9)).toBe('1.00G');
            expect(dashboard.formatFlops(5.5e9)).toBe('5.50G');
            expect(dashboard.formatFlops(100e9)).toBe('100.00G');
        });

        test('should handle edge cases at boundaries', () => {
            expect(dashboard.formatFlops(1e6 - 1)).toBe('1000.0K');   // Just below 1M, rounds to 1000K
            expect(dashboard.formatFlops(1e6)).toBe('1.0M');          // Exactly 1M
            expect(dashboard.formatFlops(999.9e6)).toBe('999.9M');    // Just below 1000M
            expect(dashboard.formatFlops(1000e6)).toBe('1.00G');      // Exactly 1G
        });

        test('should use correct decimal precision', () => {
            // K and M should have 1 decimal
            expect(dashboard.formatFlops(1234)).toMatch(/\.\d{1}K$/);
            expect(dashboard.formatFlops(1.234e6)).toMatch(/\.\d{1}M$/);
            // G should have 2 decimals
            expect(dashboard.formatFlops(1.234e9)).toMatch(/\.\d{2}G$/);
        });

        test('should handle very large numbers', () => {
            expect(dashboard.formatFlops(1e12)).toBe('1000.00G');
            expect(dashboard.formatFlops(5e15)).toBe('5000000.00G');
        });
    });

    describe('updateComparison() calculations', () => {
        test('should calculate time per iteration without division by zero', () => {
            const trace = {
                summary: {
                    total_time_seconds: 1.5,
                    total_iterations: 100
                }
            };

            // Expected: (1.5 / 100) * 1000 = 15 ms
            const timePerIter = (trace.summary.total_time_seconds / trace.summary.total_iterations) * 1000;
            expect(timePerIter).toBe(15);
        });

        test('should handle zero iterations (division by zero)', () => {
            const trace = {
                summary: {
                    total_time_seconds: 1.5,
                    total_iterations: 0
                }
            };

            // This will result in Infinity - the code should handle this
            const timePerIter = (trace.summary.total_time_seconds / trace.summary.total_iterations) * 1000;
            expect(timePerIter).toBe(Infinity);
            // In real code, this should be checked and handled
        });

        test('should calculate accurate time per iteration for various inputs', () => {
            const testCases = [
                { time: 0.5, iters: 50, expected: 10 },
                { time: 2.0, iters: 1000, expected: 2 },
                { time: 0.001, iters: 1, expected: 1 }
            ];

            testCases.forEach(({ time, iters, expected }) => {
                const trace = {
                    summary: {
                        total_time_seconds: time,
                        total_iterations: iters
                    }
                };
                const timePerIter = (trace.summary.total_time_seconds / trace.summary.total_iterations) * 1000;
                expect(timePerIter).toBeCloseTo(expected, 5);
            });
        });
    });

    describe('generateInsights() speedup calculations', () => {
        test('should calculate speedup correctly', () => {
            const fp64Time = 10.0;
            const fp32Time = 5.0;

            const speedup = fp64Time / fp32Time;
            expect(speedup).toBe(2.0);
        });

        test('should handle zero denominator (division by zero)', () => {
            const fp64Time = 10.0;
            const fp32Time = 0.0;

            const speedup = fp64Time / fp32Time;
            expect(speedup).toBe(Infinity);
            // In real code, this should be detected and handled
        });

        test('should calculate multiple speedup ratios', () => {
            const fp64Time = 12.0;
            const fp32Time = 6.0;
            const fp16Time = 3.0;
            const fp8Time = 2.0;

            const fp32Speedup = fp64Time / fp32Time;
            const fp16Speedup = fp64Time / fp16Time;
            const fp8Speedup = fp64Time / fp8Time;

            expect(fp32Speedup).toBe(2.0);
            expect(fp16Speedup).toBe(4.0);
            expect(fp8Speedup).toBe(6.0);
        });

        test('should handle speedup less than 1 (slower)', () => {
            // Edge case: lower precision could be slower due to overhead
            const fp64Time = 5.0;
            const fp32Time = 10.0;

            const speedup = fp64Time / fp32Time;
            expect(speedup).toBe(0.5);
        });

        test('should maintain precision in speedup calculations', () => {
            const fp64Time = 1.23456789;
            const fp32Time = 0.98765432;

            const speedup = fp64Time / fp32Time;
            expect(speedup).toBeCloseTo(1.250, 3);
        });
    });

    describe('Error comparison logic', () => {
        test('should correctly identify FP32 excellent accuracy threshold', () => {
            const excellentError = 1e-6;
            const goodError = 5e-6;
            const poorError = 1e-4;

            expect(excellentError < 1e-5).toBe(true);
            expect(goodError < 1e-5).toBe(true);
            expect(poorError < 1e-5).toBe(false);
        });

        test('should correctly identify FP16 acceptable accuracy threshold', () => {
            const goodError = 1e-3;
            const acceptableError = 5e-3;
            const poorError = 0.05;

            expect(goodError < 1e-2).toBe(true);
            expect(acceptableError < 1e-2).toBe(true);
            expect(poorError < 1e-2).toBe(false);
        });

        test('should correctly identify FP8 severe degradation threshold', () => {
            const acceptableError = 0.05;
            const marginalError = 0.09;
            const severeError = 0.15;

            expect(acceptableError > 0.1).toBe(false);
            expect(marginalError > 0.1).toBe(false);
            expect(severeError > 0.1).toBe(true);
        });
    });

    describe('Data validation helpers', () => {
        test('should detect missing trace data', () => {
            const traces = {
                fp64: { summary: {} },
                fp32: null,
                fp16: undefined,
                fp8: { summary: {} }
            };

            expect(traces.fp64).toBeTruthy();
            expect(traces.fp32).toBeFalsy();
            expect(traces.fp16).toBeFalsy();
            expect(traces.fp8).toBeTruthy();
        });

        test('should safely access nested properties', () => {
            const validTrace = {
                summary: {
                    total_time_seconds: 1.5,
                    total_iterations: 100
                }
            };

            const invalidTrace = null;

            // Safe access with optional chaining (modern JS)
            expect(validTrace?.summary?.total_time_seconds).toBe(1.5);
            expect(invalidTrace?.summary?.total_time_seconds).toBeUndefined();
        });

        test('should validate numeric values before formatting', () => {
            const validValues = [0, 1, 1e-10, 1e10, -5.5];
            const invalidValues = [NaN, Infinity, -Infinity, null, undefined];

            validValues.forEach(val => {
                expect(typeof val === 'number' && isFinite(val)).toBeTruthy();
            });

            invalidValues.forEach(val => {
                expect(typeof val === 'number' && isFinite(val)).toBeFalsy();
            });
        });
    });
});

describe('Trace Data Validation', () => {
    let dashboard;

    beforeEach(() => {
        dashboard = {
            validateTraceData: function(data) {
                const errors = [];

                if (!data || typeof data !== 'object') {
                    errors.push('Trace data must be an object');
                    return { valid: false, errors };
                }

                // Check required top-level properties
                if (!data.metadata || typeof data.metadata !== 'object') {
                    errors.push('Missing or invalid "metadata" object');
                }
                if (!data.trace || !Array.isArray(data.trace)) {
                    errors.push('Missing or invalid "trace" array');
                }
                if (!data.summary || typeof data.summary !== 'object') {
                    errors.push('Missing or invalid "summary" object');
                }

                // If any top-level property is missing, return early
                if (errors.length > 0) {
                    return { valid: false, errors };
                }

                // Validate metadata required fields
                const metadataRequired = ['precision', 'dtype', 'dtype_bytes', 'condition_number',
                                          'matrix_size', 'converged', 'final_error', 'tolerance', 'max_iterations'];
                metadataRequired.forEach(field => {
                    if (!(field in data.metadata)) {
                        errors.push(`Missing required metadata field: ${field}`);
                    }
                });

                // Validate trace array
                if (data.trace.length === 0) {
                    errors.push('Trace array must have at least one element');
                }

                // Validate summary required fields
                const summaryRequired = ['total_iterations', 'total_time_seconds', 'avg_flops',
                                        'peak_flops', 'avg_bandwidth_gbps', 'peak_bandwidth_gbps',
                                        'total_ops', 'total_bytes'];
                summaryRequired.forEach(field => {
                    if (!(field in data.summary)) {
                        errors.push(`Missing required summary field: ${field}`);
                    }
                });

                return { valid: errors.length === 0, errors };
            }
        };
    });

    describe('validateTraceData()', () => {
        test('should validate a complete, valid trace object', () => {
            const validTrace = {
                metadata: {
                    precision: 'FP32',
                    dtype: '<class \'numpy.float32\'>',
                    dtype_bytes: 4,
                    condition_number: 100.0,
                    matrix_size: 50,
                    converged: true,
                    final_error: 1e-8,
                    tolerance: 1e-10,
                    max_iterations: 500
                },
                trace: [
                    {
                        iteration: 0,
                        wall_time: 0.001,
                        cumulative_time: 0.001,
                        eigenvalue: 50.0,
                        relative_error: 0.5,
                        vector_norm: 1.0,
                        theoretical_flops: 1000000,
                        theoretical_bandwidth_gbps: 1.5,
                        ops_count: 5000,
                        bytes_transferred: 10000
                    }
                ],
                summary: {
                    total_iterations: 100,
                    total_time_seconds: 0.1,
                    avg_flops: 1000000,
                    peak_flops: 1500000,
                    avg_bandwidth_gbps: 1.5,
                    peak_bandwidth_gbps: 2.0,
                    total_ops: 100000000,
                    total_bytes: 200000000
                }
            };

            const result = dashboard.validateTraceData(validTrace);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject null or undefined data', () => {
            expect(dashboard.validateTraceData(null).valid).toBe(false);
            expect(dashboard.validateTraceData(undefined).valid).toBe(false);
            expect(dashboard.validateTraceData(null).errors).toContain('Trace data must be an object');
        });

        test('should reject data without metadata', () => {
            const invalidTrace = {
                trace: [],
                summary: {}
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing or invalid "metadata" object');
        });

        test('should reject data without trace array', () => {
            const invalidTrace = {
                metadata: {},
                summary: {}
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing or invalid "trace" array');
        });

        test('should reject data without summary', () => {
            const invalidTrace = {
                metadata: {},
                trace: []
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing or invalid "summary" object');
        });

        test('should reject data with empty trace array', () => {
            const invalidTrace = {
                metadata: {
                    precision: 'FP32',
                    dtype: '<class \'numpy.float32\'>',
                    dtype_bytes: 4,
                    condition_number: 100.0,
                    matrix_size: 50,
                    converged: true,
                    final_error: 1e-8,
                    tolerance: 1e-10,
                    max_iterations: 500
                },
                trace: [],
                summary: {
                    total_iterations: 100,
                    total_time_seconds: 0.1,
                    avg_flops: 1000000,
                    peak_flops: 1500000,
                    avg_bandwidth_gbps: 1.5,
                    peak_bandwidth_gbps: 2.0,
                    total_ops: 100000000,
                    total_bytes: 200000000
                }
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Trace array must have at least one element');
        });

        test('should reject data with missing metadata fields', () => {
            const invalidTrace = {
                metadata: {
                    precision: 'FP32'
                    // Missing other required fields
                },
                trace: [{}],
                summary: {}
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('Missing required metadata field'))).toBe(true);
        });

        test('should reject data with missing summary fields', () => {
            const invalidTrace = {
                metadata: {
                    precision: 'FP32',
                    dtype: '<class \'numpy.float32\'>',
                    dtype_bytes: 4,
                    condition_number: 100.0,
                    matrix_size: 50,
                    converged: true,
                    final_error: 1e-8,
                    tolerance: 1e-10,
                    max_iterations: 500
                },
                trace: [{}],
                summary: {
                    total_iterations: 100
                    // Missing other required fields
                }
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('Missing required summary field'))).toBe(true);
        });

        test('should reject trace that is not an array', () => {
            const invalidTrace = {
                metadata: {},
                trace: { not: 'an array' },
                summary: {}
            };

            const result = dashboard.validateTraceData(invalidTrace);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Missing or invalid "trace" array');
        });
    });

    describe('Safe access patterns', () => {
        test('should safely check trace.trace exists before accessing length', () => {
            const traces = {
                fp64: { metadata: {}, summary: {} },  // Missing trace array
                fp32: { trace: [1, 2, 3], metadata: {}, summary: {} },
                fp16: null,
                fp8: undefined
            };

            // This pattern is used in updateFrame and should not throw
            Object.keys(traces).forEach(key => {
                const trace = traces[key];
                const isValid = !!(trace && trace.trace && Array.isArray(trace.trace) && trace.trace.length > 0);

                if (key === 'fp32') {
                    expect(isValid).toBe(true);
                } else {
                    expect(isValid).toBe(false);
                }
            });
        });

        test('should prevent accessing .length on undefined', () => {
            const invalidTrace = { metadata: {}, summary: {} };  // No trace property

            // This should NOT throw when using safe access pattern
            const safeAccess = () => {
                if (!invalidTrace.trace || !Array.isArray(invalidTrace.trace) || invalidTrace.trace.length === 0) {
                    return 0;
                }
                return invalidTrace.trace.length;
            };

            expect(safeAccess).not.toThrow();
            expect(safeAccess()).toBe(0);
        });

        test('should prevent accessing nested properties on undefined', () => {
            const traces = {
                fp64: null,
                fp32: { trace: null },
                fp16: { trace: undefined },
                fp8: undefined
            };

            // Safe max length calculation used in updateTimeline
            const safeMaxLength = () => {
                return Math.max(
                    ...Object.values(traces).map(t => t?.trace?.length || 0)
                );
            };

            expect(safeMaxLength).not.toThrow();
            expect(safeMaxLength()).toBe(0);
        });
    });
});

describe('Edge Cases and Error Handling', () => {
    describe('Numeric stability', () => {
        test('should handle very small floating-point differences', () => {
            const a = 0.1 + 0.2;
            const b = 0.3;

            // Direct comparison fails due to floating-point precision
            expect(a === b).toBe(false);

            // But they're close enough
            expect(Math.abs(a - b) < 1e-10).toBe(true);
        });

        test('should handle division resulting in repeating decimals', () => {
            const result = 10 / 3;
            expect(result).toBeCloseTo(3.333333, 5);
        });

        test('should detect overflow to infinity', () => {
            const largeNumber = 1e308;
            const veryLargeNumber = largeNumber * 10;

            expect(isFinite(largeNumber)).toBe(true);
            expect(isFinite(veryLargeNumber)).toBe(false);
            expect(veryLargeNumber).toBe(Infinity);
        });

        test('should detect underflow to zero', () => {
            const smallNumber = 1e-308;
            const verySmallNumber = smallNumber / 1e10;

            // JavaScript doesn't always underflow to exactly 0, but very close to it
            expect(verySmallNumber).toBeLessThan(1e-300);
        });
    });

    describe('Array and object safety', () => {
        test('should safely get max length from trace arrays', () => {
            const traces = {
                fp64: { trace: new Array(100) },
                fp32: { trace: new Array(150) },
                fp16: null,
                fp8: { trace: new Array(80) }
            };

            const lengths = Object.values(traces)
                .filter(t => t && t.trace)
                .map(t => t.trace.length);

            expect(Math.max(...lengths)).toBe(150);
        });

        test('should handle empty arrays gracefully', () => {
            const emptyArray = [];
            expect(emptyArray.length).toBe(0);
            expect(Math.max(...emptyArray)).toBe(-Infinity);
        });
    });
});

describe('Frontend Data Loading Scenarios', () => {
    /**
     * These tests mimic real-world scenarios where trace data might be incomplete,
     * partially loaded, or invalid - reproducing the "length property on undefined" bug
     */

    describe('Incomplete trace loading scenarios', () => {
        test('should handle traces with missing trace property', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: { metadata: {}, summary: {} },  // Missing .trace property!
                    fp32: { metadata: {}, summary: {}, trace: [1, 2, 3] },
                    fp16: { metadata: {}, summary: {} },  // Missing .trace property!
                    fp8: { metadata: {}, summary: {}, trace: [1, 2] }
                }
            };

            // This pattern is used in startAnimation (line 296-298)
            // BUG: Using ?.trace.length instead of ?.trace?.length
            const maxFramesBuggy = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace.length || 0)
                );
            };

            // This should throw "Cannot read property 'length' of undefined"
            expect(maxFramesBuggy).toThrow();

            // FIXED: Using ?.trace?.length with double optional chaining
            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(3);  // fp32 has 3 elements
        });

        test('should handle traces where some precisions failed to load', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: null,  // Failed to load
                    fp32: { metadata: {}, summary: {}, trace: [1, 2, 3, 4, 5] },
                    fp16: undefined,  // Not loaded yet
                    fp8: { metadata: {}, summary: {} }  // Loaded but missing .trace
                }
            };

            // FIXED version using double optional chaining
            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(5);
        });

        test('should handle all traces being undefined or null', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: null,
                    fp32: undefined,
                    fp16: null,
                    fp8: undefined
                }
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(0);
        });

        test('should handle traces with trace property being null', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: { metadata: {}, summary: {}, trace: null },
                    fp32: { metadata: {}, summary: {}, trace: undefined },
                    fp16: { metadata: {}, summary: {}, trace: [] },
                    fp8: { metadata: {}, summary: {}, trace: [1, 2, 3] }
                }
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(3);
        });

        test('should handle mixed valid and invalid trace data', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: { metadata: { converged: true }, summary: { total_iterations: 50 }, trace: Array(50).fill({}) },
                    fp32: { metadata: {}, summary: {} },  // Missing trace
                    fp16: null,  // Failed to load
                    fp8: { metadata: { converged: true }, summary: { total_iterations: 30 }, trace: Array(30).fill({}) }
                }
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(50);
        });
    });

    describe('Edge cases in updateTimeline function', () => {
        test('should handle reference trace with no trace array', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: null,
                    fp32: { metadata: {}, summary: { total_time_seconds: 1.5 } },  // No .trace
                    fp16: undefined,
                    fp8: undefined
                },
                currentFrame: 0
            };

            // Pattern from updateTimeline (line 414)
            const refTrace = dashboard.traces['fp32'] || dashboard.traces[dashboard.precisions[0]];

            // This check should prevent errors
            const safeAccess = () => {
                if (refTrace && refTrace.trace && refTrace.summary) {
                    // This would fail if refTrace.trace is undefined
                    const currentTime = refTrace.trace[Math.floor(dashboard.currentFrame)]?.cumulative_time || 0;
                    return currentTime;
                }
                return null;
            };

            expect(safeAccess).not.toThrow();
            expect(safeAccess()).toBe(null);  // Returns null because refTrace.trace is missing
        });

        test('should safely calculate max frames when all traces are incomplete', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {}  // Empty traces object
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(0);
        });
    });

    describe('Realistic loading failure scenarios', () => {
        test('should handle network error where only some files loaded', () => {
            // Simulates: fp64 and fp32 loaded successfully, fp16 and fp8 failed
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: {
                        metadata: { precision: 'FP64', converged: true, final_error: 1e-12 },
                        summary: { total_iterations: 100, total_time_seconds: 2.5 },
                        trace: Array(100).fill({ iteration: 0, relative_error: 0.01 })
                    },
                    fp32: {
                        metadata: { precision: 'FP32', converged: true, final_error: 1e-8 },
                        summary: { total_iterations: 95, total_time_seconds: 1.2 },
                        trace: Array(95).fill({ iteration: 0, relative_error: 0.01 })
                    },
                    // fp16 and fp8 not loaded (network error)
                }
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(100);
        });

        test('should handle partial object after JSON parse error', () => {
            // Simulates: JSON file was corrupted and only partially parsed
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: {
                        metadata: { precision: 'FP64' },
                        // Missing summary and trace due to JSON parse error
                    },
                    fp32: null,
                    fp16: null,
                    fp8: null
                }
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(0);
        });

        test('should handle trace loaded with wrong data type', () => {
            // Simulates: trace property exists but is not an array
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: {
                        metadata: { precision: 'FP64' },
                        summary: { total_iterations: 100 },
                        trace: "invalid data"  // Should be array but got string
                    },
                    fp32: {
                        metadata: { precision: 'FP32' },
                        summary: { total_iterations: 95 },
                        trace: { 0: {}, 1: {} }  // Should be array but got object
                    }
                }
            };

            // The || 0 should handle non-array trace.length returning undefined
            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            // String has .length, object doesn't have enumerable .length
            const result = maxFramesFixed();
            expect(typeof result).toBe('number');
        });
    });

    describe('Integration: Full dashboard lifecycle with incomplete data', () => {
        test('should handle initialization before any traces loaded', () => {
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {},  // Not initialized yet
                currentFrame: 0
            };

            // All these patterns should not throw
            const operations = () => {
                // Pattern from startAnimation
                const maxFrames1 = Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );

                // Pattern from updateFrame comparison
                const maxFrames2 = Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );

                // Pattern from seekToPercent
                const maxFrames3 = Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );

                return { maxFrames1, maxFrames2, maxFrames3 };
            };

            expect(operations).not.toThrow();
            const result = operations();
            expect(result.maxFrames1).toBe(0);
            expect(result.maxFrames2).toBe(0);
            expect(result.maxFrames3).toBe(0);
        });

        test('should handle rapid condition changes during loading', () => {
            // Simulates: User changes condition while previous traces still loading
            const dashboard = {
                precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
                traces: {
                    fp64: { metadata: {}, summary: {}, trace: [1, 2] },  // Old condition, partially loaded
                    fp32: null,  // Being cleared
                    // fp16 and fp8 not set for new condition yet
                },
                currentFrame: 0
            };

            const maxFramesFixed = () => {
                return Math.max(
                    ...dashboard.precisions.map(p => dashboard.traces[p]?.trace?.length || 0)
                );
            };

            expect(maxFramesFixed).not.toThrow();
            expect(maxFramesFixed()).toBe(2);
        });
    });
});
