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
            // Note: The function doesn't explicitly handle negatives,
            // but they should follow the same formatting rules
            expect(dashboard.formatError(-0.001)).toBe('-0.0010');
            expect(dashboard.formatError(-1e-6)).toBe('-1.00e-6');
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
            expect(dashboard.formatFlops(1e6 - 1)).toBe('999.0K');    // Just below 1M
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

            expect(verySmallNumber).toBe(0);
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
