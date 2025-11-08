/**
 * PrecisionLens Dashboard
 * Interactive visualization of floating-point precision impact on numerical algorithms
 */

class PrecisionDashboard {
    constructor() {
        this.traces = {};
        this.currentCondition = 100;
        this.currentFrame = 0;
        this.playing = false;
        this.speed = 1;
        this.animationInterval = null;
        this.precisions = ['fp64', 'fp32', 'fp16', 'fp8'];
        this.colors = {
            fp64: '#60a5fa',  // blue-400
            fp32: '#34d399',  // green-400
            fp16: '#fbbf24',  // yellow-400
            fp8: '#fb923c'    // orange-400
        };

        this.init();
    }

    /**
     * Validates trace data structure to ensure it has all required fields
     * @param {Object} data - The trace data to validate
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    validateTraceData(data) {
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

    async init() {
        // Set up event listeners
        this.setupEventListeners();

        // Initialize visualizations BEFORE loading data
        // This ensures plots exist when loadTraces() calls reset()
        this.initPlots();
        this.initGauges();

        // Load initial traces (this calls reset() which updates the plots)
        await this.loadTraces(this.currentCondition);
    }

    setupEventListeners() {
        // Condition selector
        document.getElementById('conditionSelector').addEventListener('change', (e) => {
            this.currentCondition = parseInt(e.target.value);
            this.loadTraces(this.currentCondition);
        });

        // Play/Pause button
        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Speed selector
        document.getElementById('speedSelector').addEventListener('change', (e) => {
            this.speed = parseFloat(e.target.value);
        });

        // Timeline scrubber
        document.getElementById('timeline').addEventListener('input', (e) => {
            const percent = parseFloat(e.target.value);
            this.seekToPercent(percent);
        });

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.reset();
        });
    }

    async loadTraces(conditionNumber) {
        this.playing = false;
        this.clearAnimation();

        // Show loading state
        this.precisions.forEach(p => {
            document.getElementById(`status-${p}`).textContent = 'Loading...';
        });

        try {
            // Load all four precision traces for this condition number
            const loadPromises = this.precisions.map(async (precision) => {
                const filename = `${precision}_cond${conditionNumber}_n50.json`;
                const response = await fetch(`traces/${filename}`);

                if (!response.ok) {
                    throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                // Validate the loaded data
                const validation = this.validateTraceData(data);
                if (!validation.valid) {
                    throw new Error(`Invalid trace data in ${filename}:\n${validation.errors.join('\n')}`);
                }

                this.traces[precision] = data;
            });

            await Promise.all(loadPromises);

            // Reset to start
            this.reset();

            console.log('Traces loaded:', this.currentCondition);

        } catch (error) {
            console.error('Error loading traces:', error);
            alert(`Failed to load trace data: ${error.message}\n\nPlease check that all trace files exist in the traces/ directory and the page is being served via HTTP/HTTPS.`);

            // Reset status to error
            this.precisions.forEach(p => {
                const statusEl = document.getElementById(`status-${p}`);
                statusEl.textContent = 'Error';
                statusEl.className = 'px-3 py-1 rounded-full text-xs font-medium bg-red-900 text-red-200';
            });
        }
    }

    initPlots() {
        const layout = {
            paper_bgcolor: '#1f2937',
            plot_bgcolor: '#111827',
            font: { color: '#9ca3af', family: 'Inter, sans-serif' },
            margin: { l: 60, r: 20, t: 20, b: 40 },
            xaxis: {
                title: 'Iteration',
                gridcolor: '#374151',
                zerolinecolor: '#4b5563'
            },
            yaxis: {
                title: 'Relative Error',
                type: 'log',
                exponentformat: 'power',
                gridcolor: '#374151',
                zerolinecolor: '#4b5563'
            },
            showlegend: false
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        // Initialize empty plots for each precision
        this.precisions.forEach(precision => {
            const plotDiv = document.getElementById(`plot-${precision}`);
            const data = [{
                x: [],
                y: [],
                type: 'scatter',
                mode: 'lines',
                line: {
                    color: this.colors[precision],
                    width: 2
                }
            }];

            Plotly.newPlot(plotDiv, data, layout, config);
        });

        // Initialize comparison plot (FP32, FP16, FP8 error ratios vs FP64)
        const comparisonLayout = {
            ...layout,
            yaxis: {
                title: 'Error Ratio (vs FP64)',
                type: 'log',
                exponentformat: 'power',
                gridcolor: '#374151',
                zerolinecolor: '#4b5563'
            },
            showlegend: true,
            legend: {
                x: 1,
                xanchor: 'right',
                y: 1,
                yanchor: 'top',
                bgcolor: 'rgba(31, 41, 55, 0.8)',
                bordercolor: '#374151',
                borderwidth: 1
            }
        };

        const comparisonData = [
            {
                x: [],
                y: [],
                type: 'scatter',
                mode: 'lines',
                name: 'FP32',
                line: { color: this.colors.fp32, width: 2 }
            },
            {
                x: [],
                y: [],
                type: 'scatter',
                mode: 'lines',
                name: 'FP16',
                line: { color: this.colors.fp16, width: 2 }
            },
            {
                x: [],
                y: [],
                type: 'scatter',
                mode: 'lines',
                name: 'FP8',
                line: { color: this.colors.fp8, width: 2 }
            }
        ];

        Plotly.newPlot('plot-comparison', comparisonData, comparisonLayout, config);
    }

    initGauges() {
        // FLOPS gauge
        const flopsGauge = {
            type: 'indicator',
            mode: 'gauge+number',
            value: 0,
            number: { suffix: ' M', font: { size: 24, color: '#e5e7eb' } },
            gauge: {
                axis: { range: [null, 1000], tickfont: { size: 10, color: '#9ca3af' } },
                bar: { color: '#3b82f6' },
                bgcolor: '#1f2937',
                borderwidth: 2,
                bordercolor: '#374151',
                steps: [
                    { range: [0, 250], color: '#111827' },
                    { range: [250, 500], color: '#1f2937' },
                    { range: [500, 750], color: '#111827' },
                    { range: [750, 1000], color: '#1f2937' }
                ]
            }
        };

        const gaugeLayout = {
            paper_bgcolor: '#1f2937',
            font: { color: '#9ca3af', family: 'Inter, sans-serif' },
            margin: { t: 0, b: 0, l: 0, r: 0 },
            height: 130
        };

        const gaugeConfig = { displayModeBar: false, responsive: true };

        Plotly.newPlot('gauge-flops', [flopsGauge], gaugeLayout, gaugeConfig);

        // Bandwidth gauge
        const bandwidthGauge = {
            ...flopsGauge,
            gauge: {
                ...flopsGauge.gauge,
                axis: { range: [null, 2], tickfont: { size: 10, color: '#9ca3af' } },
                bar: { color: '#10b981' },
                steps: [
                    { range: [0, 0.5], color: '#111827' },
                    { range: [0.5, 1.0], color: '#1f2937' },
                    { range: [1.0, 1.5], color: '#111827' },
                    { range: [1.5, 2.0], color: '#1f2937' }
                ]
            },
            number: { suffix: ' GB/s', font: { size: 24, color: '#e5e7eb' } }
        };

        Plotly.newPlot('gauge-bandwidth', [bandwidthGauge], gaugeLayout, gaugeConfig);
    }

    togglePlayPause() {
        this.playing = !this.playing;

        if (this.playing) {
            this.startAnimation();
            document.getElementById('playIcon').textContent = '⏸';
            document.getElementById('playText').textContent = 'Pause';
        } else {
            this.clearAnimation();
            document.getElementById('playIcon').textContent = '▶';
            document.getElementById('playText').textContent = 'Play';
        }
    }

    startAnimation() {
        this.clearAnimation();

        // Base frame rate: 60 FPS
        const frameInterval = 1000 / 60;

        this.animationInterval = setInterval(() => {
            // Advance by speed multiplier
            this.currentFrame += this.speed;

            // Find max frames across all precisions
            const maxFrames = Math.max(
                ...this.precisions.map(p => this.traces[p]?.trace?.length || 0)
            );

            if (this.currentFrame >= maxFrames) {
                this.currentFrame = maxFrames - 1;
                this.togglePlayPause();
                return;
            }

            this.updateFrame(Math.floor(this.currentFrame));

        }, frameInterval);
    }

    clearAnimation() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    updateFrame(frameIndex) {
        this.precisions.forEach(precision => {
            const trace = this.traces[precision];
            if (!trace || !trace.trace || !Array.isArray(trace.trace) || trace.trace.length === 0) return;

            const maxFrame = Math.min(frameIndex, trace.trace.length - 1);
            const currentData = trace.trace.slice(0, maxFrame + 1);

            // Update plot
            this.updatePlot(precision, currentData);

            // Update metrics
            this.updateMetrics(precision, trace.trace[maxFrame]);

            // Update status
            this.updateStatus(precision, trace, maxFrame);
        });

        // Update comparison plot
        this.updateComparisonPlot(frameIndex);

        // Update gauges (using FP32 as reference, or first available)
        const refPrecision = this.traces['fp32'] ? 'fp32' : this.precisions[0];
        const refTrace = this.traces[refPrecision];
        if (refTrace && refTrace.trace[frameIndex]) {
            this.updateGauges(refTrace.trace[frameIndex]);
        }

        // Update timeline
        this.updateTimeline();

        // Update comparison table and insights at end
        if (frameIndex === Math.max(...this.precisions.map(p => this.traces[p]?.trace?.length || 0)) - 1) {
            this.updateComparison();
            this.generateInsights();
        }
    }

    updatePlot(precision, data) {
        const plotDiv = document.getElementById(`plot-${precision}`);

        // Filter out NaN values to prevent plotting issues
        const validData = data.filter(d =>
            !isNaN(d.relative_error) &&
            isFinite(d.relative_error) &&
            d.relative_error > 0
        );

        const update = {
            x: [validData.map(d => d.iteration)],
            y: [validData.map(d => Math.max(d.relative_error, 1e-12))]  // Clamp to avoid log(0)
        };

        Plotly.restyle(plotDiv, update, [0]);
    }

    updateComparisonPlot(frameIndex) {
        const fp64Trace = this.traces['fp64'];
        if (!fp64Trace || !fp64Trace.trace) return;

        const comparePrecisions = ['fp32', 'fp16', 'fp8'];
        const updates = { x: [], y: [] };

        comparePrecisions.forEach((precision, index) => {
            const trace = this.traces[precision];
            if (!trace || !trace.trace) {
                updates.x.push([]);
                updates.y.push([]);
                return;
            }

            const maxFrame = Math.min(frameIndex, trace.trace.length - 1);
            const data = [];

            // Calculate error ratios for each iteration up to maxFrame
            for (let i = 0; i <= maxFrame; i++) {
                const fp64Error = fp64Trace.trace[i]?.relative_error;
                const precisionError = trace.trace[i]?.relative_error;

                if (fp64Error && precisionError &&
                    !isNaN(fp64Error) && !isNaN(precisionError) &&
                    isFinite(fp64Error) && isFinite(precisionError) &&
                    fp64Error > 0 && precisionError > 0) {
                    const ratio = precisionError / fp64Error;
                    data.push({
                        iteration: trace.trace[i].iteration,
                        ratio: Math.max(ratio, 1e-3)  // Clamp minimum for log scale
                    });
                }
            }

            updates.x.push(data.map(d => d.iteration));
            updates.y.push(data.map(d => d.ratio));
        });

        Plotly.restyle('plot-comparison', updates, [0, 1, 2]);
    }

    updateMetrics(precision, iterData) {
        if (!iterData) return;

        document.getElementById(`iter-${precision}`).textContent = iterData.iteration;
        document.getElementById(`eigenvalue-${precision}`).textContent = this.formatEigenvalue(iterData.eigenvalue);
        document.getElementById(`error-${precision}`).textContent = this.formatError(iterData.relative_error);
        document.getElementById(`time-${precision}`).textContent = this.formatTime(iterData.cumulative_time);
        document.getElementById(`flops-${precision}`).textContent = this.formatFlops(iterData.theoretical_flops);
    }

    updateStatus(precision, trace, frameIndex) {
        const statusEl = document.getElementById(`status-${precision}`);

        if (!trace || !trace.trace || !Array.isArray(trace.trace) || !trace.metadata) return;

        if (frameIndex >= trace.trace.length - 1) {
            if (trace.metadata.converged) {
                statusEl.textContent = 'Converged';
                statusEl.className = 'px-3 py-1 rounded-full text-xs font-medium status-converged';
            } else {
                statusEl.textContent = 'Max Iterations';
                statusEl.className = 'px-3 py-1 rounded-full text-xs font-medium status-failed';
            }
        } else {
            statusEl.textContent = 'Running';
            statusEl.className = 'px-3 py-1 rounded-full text-xs font-medium status-running';
        }
    }

    updateGauges(iterData) {
        if (!iterData) return;

        // Update FLOPS gauge
        Plotly.restyle('gauge-flops', {
            value: [iterData.theoretical_flops / 1e6]  // Convert to MFLOPS
        }, [0]);

        // Update bandwidth gauge
        Plotly.restyle('gauge-bandwidth', {
            value: [iterData.theoretical_bandwidth_gbps]
        }, [0]);
    }

    updateTimeline() {
        const maxFrames = Math.max(
            ...this.precisions.map(p => this.traces[p]?.trace?.length || 0)
        );

        const percent = (this.currentFrame / maxFrames) * 100;
        document.getElementById('timeline').value = percent;

        // Update time display
        const refTrace = this.traces['fp32'] || this.traces[this.precisions[0]];
        if (refTrace && refTrace.trace && refTrace.summary) {
            const currentTime = refTrace.trace[Math.floor(this.currentFrame)]?.cumulative_time || 0;
            const maxTime = refTrace.summary.total_time_seconds;

            document.getElementById('currentTime').textContent = `${currentTime.toFixed(4)}s`;
            document.getElementById('maxTime').textContent = `${maxTime.toFixed(4)}s`;
        }
    }

    updateComparison() {
        const tbody = document.getElementById('comparisonTableBody');
        tbody.innerHTML = '';

        const metrics = [
            { label: 'Iterations', key: 'total_iterations', format: (v) => v.toLocaleString() },
            { label: 'Time (ms)', key: 'total_time_seconds', format: (v) => (v * 1000).toFixed(2) },
            { label: 'Time/Iter (ms)', key: 'time_per_iter', format: (v) => v.toFixed(3) },
            { label: 'Final Error', key: 'final_error', format: (v) => this.formatError(v) },
            { label: 'Error vs FP64', key: 'error_vs_fp64', format: (v) => `${v.toFixed(1)}×` },
            { label: 'Avg FLOPS (M)', key: 'avg_flops', format: (v) => (v / 1e6).toFixed(1) },
            { label: 'Converged', key: 'converged', format: (v) => v ? '✓' : '✗' }
        ];

        metrics.forEach(metric => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700';

            let html = `<td class="py-2">${metric.label}</td>`;

            this.precisions.forEach(precision => {
                const trace = this.traces[precision];
                let value = '—';

                if (trace && trace.metadata && trace.summary) {
                    if (metric.key === 'final_error') {
                        value = metric.format(trace.metadata[metric.key]);
                    } else if (metric.key === 'converged') {
                        value = metric.format(trace.metadata[metric.key]);
                    } else if (metric.key === 'time_per_iter') {
                        // Calculate average wall time per iteration in milliseconds
                        if (trace.summary.total_iterations > 0) {
                            const timePerIter = (trace.summary.total_time_seconds / trace.summary.total_iterations) * 1000;
                            value = metric.format(timePerIter);
                        }
                    } else if (metric.key === 'error_vs_fp64') {
                        // Calculate error ratio compared to FP64
                        const fp64Trace = this.traces['fp64'];
                        if (precision === 'fp64') {
                            value = '1.0×';  // FP64 baseline
                        } else if (fp64Trace && fp64Trace.metadata && fp64Trace.metadata.final_error > 0) {
                            const errorRatio = trace.metadata.final_error / fp64Trace.metadata.final_error;
                            value = metric.format(errorRatio);
                        }
                    } else {
                        value = metric.format(trace.summary[metric.key]);
                    }
                }

                html += `<td class="text-right py-2">${value}</td>`;
            });

            row.innerHTML = html;
            tbody.appendChild(row);
        });
    }

    generateInsights() {
        const insightsPanel = document.getElementById('insightsPanel');
        const insights = [];

        const fp64 = this.traces['fp64'];
        const fp32 = this.traces['fp32'];
        const fp16 = this.traces['fp16'];
        const fp8 = this.traces['fp8'];

        // Validate all traces have required structure
        const validateTrace = (t) => t && t.summary && t.metadata;
        if (!validateTrace(fp64) || !validateTrace(fp32) || !validateTrace(fp16) || !validateTrace(fp8)) return;

        // Speedup analysis
        const fp64Time = fp64.summary.total_time_seconds;
        const fp32Speedup = fp64Time / fp32.summary.total_time_seconds;
        const fp16Speedup = fp64Time / fp16.summary.total_time_seconds;
        const fp8Speedup = fp64Time / fp8.summary.total_time_seconds;

        insights.push(`<strong>⚡ Speedup:</strong> FP32 is ${fp32Speedup.toFixed(1)}× faster, FP16 is ${fp16Speedup.toFixed(1)}× faster, FP8 is ${fp8Speedup.toFixed(1)}× faster than FP64.`);

        // Accuracy analysis
        const fp64Error = fp64.metadata.final_error;
        const fp32Error = fp32.metadata.final_error;
        const fp16Error = fp16.metadata.final_error;
        const fp8Error = fp8.metadata.final_error;

        // Error comparison vs FP64
        const fp32ErrorRatio = fp32Error / fp64Error;
        const fp16ErrorRatio = fp16Error / fp64Error;
        const fp8ErrorRatio = fp8Error / fp64Error;

        insights.push(`<strong>📊 Error vs FP64:</strong> FP32 error is ${fp32ErrorRatio.toFixed(1)}× higher, FP16 is ${fp16ErrorRatio.toFixed(1)}× higher, FP8 is ${fp8ErrorRatio.toFixed(0)}× higher than FP64 baseline.`);

        if (fp32Error < 1e-5) {
            insights.push(`<strong>✓ FP32 Performance:</strong> Achieves excellent accuracy (${this.formatError(fp32Error)}) with significant speedup — ideal for most applications.`);
        }

        if (fp16Error < 1e-2) {
            insights.push(`<strong>⚠️ FP16 Tradeoff:</strong> Final error of ${this.formatError(fp16Error)} represents a ${fp16Speedup.toFixed(1)}× speedup. Acceptable for many ML inference tasks.`);
        } else {
            insights.push(`<strong>❌ FP16 Limitation:</strong> Error of ${this.formatError(fp16Error)} may be too high for precision-critical applications.`);
        }

        if (fp8Error > 0.1) {
            insights.push(`<strong>🔴 FP8 Challenge:</strong> Error of ${this.formatError(fp8Error)} (${(fp8Error * 100).toFixed(1)}%) shows severe degradation. FP8 best suited for inference with error-tolerant models.`);
        }

        // Convergence analysis
        const fp64Iters = fp64.summary.total_iterations;
        const fp32Iters = fp32.summary.total_iterations;

        insights.push(`<strong>🔄 Convergence:</strong> FP64 took ${fp64Iters} iterations, FP32 took ${fp32Iters} iterations. Lower precision can affect convergence behavior.`);

        // Hardware relevance
        insights.push(`<strong>💡 AI Hardware Context:</strong> NVIDIA's Hopper (H100) achieves 2000 TFLOPS in FP8 vs 60 TFLOPS in FP16, making precision choice critical for performance.`);

        insightsPanel.innerHTML = insights.map(i => `<p>${i}</p>`).join('');
    }

    seekToPercent(percent) {
        const maxFrames = Math.max(
            ...this.precisions.map(p => this.traces[p]?.trace?.length || 0)
        );

        this.currentFrame = Math.floor((percent / 100) * maxFrames);
        this.updateFrame(this.currentFrame);
    }

    reset() {
        this.playing = false;
        this.currentFrame = 0;
        this.clearAnimation();

        document.getElementById('playIcon').textContent = '▶';
        document.getElementById('playText').textContent = 'Play';

        this.updateFrame(0);
        this.updateComparison();
        this.generateInsights();
    }

    updateUI() {
        // Initial update
        this.updateFrame(0);
        this.updateComparison();
        this.generateInsights();
    }

    // Utility formatters
    formatError(error) {
        if (isNaN(error) || !isFinite(error)) return 'NaN';
        if (error === 0) return '0';
        if (error < 1e-9) return error.toExponential(1);
        if (error < 1e-3) return error.toExponential(2);
        if (error < 1) return error.toFixed(4);
        return error.toFixed(2);
    }

    formatFlops(flops) {
        if (!flops || flops === 0) return '—';
        const mflops = flops / 1e6;
        if (mflops < 1) return `${(flops / 1e3).toFixed(1)}K`;
        if (mflops < 1000) return `${mflops.toFixed(1)}M`;
        return `${(mflops / 1000).toFixed(2)}G`;
    }

    formatEigenvalue(eigenvalue) {
        if (isNaN(eigenvalue) || !isFinite(eigenvalue)) return 'NaN';
        if (eigenvalue === 0) return '0';
        if (Math.abs(eigenvalue) < 1e-3) return eigenvalue.toExponential(2);
        if (Math.abs(eigenvalue) < 10) return eigenvalue.toFixed(4);
        if (Math.abs(eigenvalue) < 1000) return eigenvalue.toFixed(2);
        return eigenvalue.toFixed(1);
    }

    formatTime(timeSeconds) {
        if (isNaN(timeSeconds) || !isFinite(timeSeconds) || timeSeconds < 0) return '—';
        if (timeSeconds < 1e-6) return `${(timeSeconds * 1e9).toFixed(1)}ns`;
        if (timeSeconds < 1e-3) return `${(timeSeconds * 1e6).toFixed(1)}μs`;
        if (timeSeconds < 1) return `${(timeSeconds * 1e3).toFixed(2)}ms`;
        return `${timeSeconds.toFixed(3)}s`;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new PrecisionDashboard();
});
