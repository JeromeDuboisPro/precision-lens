/**
 * PrecisionLens Dashboard
 * Interactive visualization of floating-point precision impact on numerical algorithms
 */

class PrecisionDashboard {
  constructor() {
    this.traces = {};
    this.currentCondition = 100;
    this.currentTime = 0; // Changed from currentFrame to currentTime
    this.maxTime = 0; // Maximum time across all precisions
    this.playing = false;
    this.speed = 0.1; // Default to 0.1x (slower playback)
    this.animationInterval = null;
    this.precisions = ['fp64', 'fp32', 'fp16', 'fp8'];
    this.colors = {
      fp64: '#60a5fa', // blue-400
      fp32: '#34d399', // green-400
      fp16: '#fbbf24', // yellow-400
      fp8: '#fb923c', // orange-400
    };
    this.config = null; // Will be loaded from config.json
    this.highlightedPrecision = null; // For click-to-highlight feature
    this.expandedCard = null; // For expandable card feature

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
    const metadataRequired = [
      'precision',
      'dtype',
      'dtype_bytes',
      'condition_number',
      'matrix_size',
      'converged',
      'final_error',
      'tolerance',
      'max_iterations',
    ];
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
    const summaryRequired = [
      'total_iterations',
      'total_time_seconds',
      'avg_flops',
      'peak_flops',
      'avg_bandwidth_gbps',
      'peak_bandwidth_gbps',
      'total_ops',
      'total_bytes',
    ];
    summaryRequired.forEach(field => {
      if (!(field in data.summary)) {
        errors.push(`Missing required summary field: ${field}`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Find the iteration index closest to a given time for a specific precision
   * @param {string} precision - The precision (fp64, fp32, fp16, fp8)
   * @param {number} targetTime - The target time in seconds
   * @returns {number} The iteration index at or just past the target time
   */
  findIterationAtTime(precision, targetTime) {
    const trace = this.traces[precision];
    if (!trace || !trace.trace || trace.trace.length === 0) return 0;

    const traceData = trace.trace;

    // Handle edge cases
    if (targetTime <= 0) return 0;
    if (targetTime >= traceData[traceData.length - 1].cumulative_time) {
      return traceData.length - 1;
    }

    // Binary search for efficiency
    let left = 0;
    let right = traceData.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (traceData[mid].cumulative_time < targetTime) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  async init() {
    // Load configuration first
    try {
      const response = await fetch('config.json');
      if (!response.ok) {
        throw new Error(`Failed to load config.json: ${response.status}`);
      }
      this.config = await response.json();
      console.log('Configuration loaded:', this.config);
    } catch (error) {
      console.error('Error loading config:', error);
      alert('Failed to load configuration. Using default settings.');
      // Fallback to defaults
      this.config = {
        matrixSize: 50,
        conditionNumbers: [10, 100, 1000],
        precisions: ['fp64', 'fp32', 'fp16', 'fp8'],
        tracesDirectory: 'traces',
      };
    }

    // Set up event listeners
    this.setupEventListeners();

    // Initialize visualizations BEFORE loading data
    // This ensures plots exist when loadTraces() calls reset()
    this.initPlots();
    this.initGauges();

    // Don't load traces on startup - wait for user interaction
    // Traces will be loaded when user changes condition or clicks play
  }

  setupEventListeners() {
    // Condition selector
    document
      .getElementById('conditionSelector')
      .addEventListener('change', e => {
        this.currentCondition = parseInt(e.target.value);
        this.loadTraces(this.currentCondition);
      });

    // Play/Pause button
    document.getElementById('playPauseBtn').addEventListener('click', () => {
      this.togglePlayPause();
    });

    // Speed selector
    document.getElementById('speedSelector').addEventListener('change', e => {
      this.speed = parseFloat(e.target.value);
    });

    // Timeline scrubber
    document.getElementById('timeline').addEventListener('input', e => {
      const percent = parseFloat(e.target.value);
      this.seekToPercent(percent);
    });

    // Reset button
    document.getElementById('resetBtn').addEventListener('click', () => {
      this.reset();
    });

    // Card click handlers for expand/collapse functionality
    this.precisions.forEach(precision => {
      const card = document.querySelector(
        `[class*="border-${
          precision === 'fp64'
            ? 'blue'
            : precision === 'fp32'
              ? 'green'
              : precision === 'fp16'
                ? 'yellow'
                : 'orange'
        }"]`
      );
      if (card) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', e => {
          // Don't trigger if clicking on a child element that's interactive
          if (e.target.closest('button, a, input')) return;
          this.toggleHighlight(precision);
        });
      }
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
      const loadPromises = this.precisions.map(async precision => {
        const filename = `${precision}_cond${conditionNumber}_n${this.config.matrixSize}.json`;
        const response = await fetch(
          `${this.config.tracesDirectory}/${filename}`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load ${filename}: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();

        // Validate the loaded data
        const validation = this.validateTraceData(data);
        if (!validation.valid) {
          throw new Error(
            `Invalid trace data in ${filename}:\n${validation.errors.join(
              '\n'
            )}`
          );
        }

        this.traces[precision] = data;
      });

      await Promise.all(loadPromises);

      // Calculate max time across all precisions
      this.maxTime = Math.max(
        ...this.precisions.map(
          p => this.traces[p]?.summary?.total_time_seconds || 0
        )
      );

      // Calculate and display speedups based on total convergence time
      this.updateSpeedupDisplays();

      // Reset to start
      this.reset();

      console.log('Traces loaded:', this.currentCondition);
      console.log('Max time:', this.maxTime);
    } catch (error) {
      console.error('Error loading traces:', error);
      alert(
        `Failed to load trace data: ${error.message}\n\nPlease check that all trace files exist in the traces/ directory and the page is being served via HTTP/HTTPS.`
      );

      // Reset status to error
      this.precisions.forEach(p => {
        const statusEl = document.getElementById(`status-${p}`);
        statusEl.textContent = 'Error';
        statusEl.className =
          'px-3 py-1 rounded-full text-xs font-medium bg-red-900 text-red-200';
      });
    }
  }

  initPlots() {
    const config = {
      responsive: true,
      displayModeBar: false,
    };

    // Initialize unified convergence plot with all 4 precisions
    const unifiedLayout = {
      paper_bgcolor: '#1f2937',
      plot_bgcolor: '#111827',
      font: { color: '#9ca3af', family: 'Inter, sans-serif' },
      margin: { l: 60, r: 20, t: 20, b: 50 },
      xaxis: {
        title: 'Time (s)',
        gridcolor: '#374151',
        zerolinecolor: '#4b5563',
      },
      yaxis: {
        title: 'Relative Error',
        type: 'log',
        exponentformat: 'power',
        gridcolor: '#374151',
        zerolinecolor: '#4b5563',
      },
      showlegend: true,
      legend: {
        x: 1,
        xanchor: 'right',
        y: 1,
        yanchor: 'top',
        bgcolor: 'rgba(31, 41, 55, 0.9)',
        bordercolor: '#374151',
        borderwidth: 1,
      },
      hovermode: 'closest',
    };

    const unifiedData = this.precisions.map(precision => ({
      x: [],
      y: [],
      type: 'scatter',
      mode: 'lines',
      name: precision.toUpperCase(),
      line: {
        color: this.colors[precision],
        width: 3,
      },
      hovertemplate: '%{y:.2e}<extra>' + precision.toUpperCase() + '</extra>',
    }));

    const plotDiv = document.getElementById('plot-unified');
    Plotly.newPlot(plotDiv, unifiedData, unifiedLayout, config);

    // Add click handler for highlighting
    plotDiv.on('plotly_click', data => {
      if (data.points && data.points.length > 0) {
        const precision = this.precisions[data.points[0].curveNumber];
        this.toggleHighlight(precision);
      }
    });

    // Initialize comparison plot (FP32, FP16, FP8 eigenvalue errors vs FP64)
    const comparisonLayout = {
      paper_bgcolor: '#1f2937',
      plot_bgcolor: '#111827',
      font: { color: '#9ca3af', family: 'Inter, sans-serif' },
      margin: { l: 60, r: 20, t: 20, b: 50 },
      xaxis: {
        title: 'Time (s)',
        gridcolor: '#374151',
        zerolinecolor: '#4b5563',
      },
      yaxis: {
        title: 'Relative Error vs FP64 Eigenvalue',
        type: 'log',
        exponentformat: 'power',
        gridcolor: '#374151',
        zerolinecolor: '#4b5563',
      },
      showlegend: true,
      legend: {
        x: 1,
        xanchor: 'right',
        y: 1,
        yanchor: 'top',
        bgcolor: 'rgba(31, 41, 55, 0.8)',
        bordercolor: '#374151',
        borderwidth: 1,
      },
    };

    const comparisonData = [
      {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines',
        name: 'FP32',
        line: { color: this.colors.fp32, width: 2 },
      },
      {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines',
        name: 'FP16',
        line: { color: this.colors.fp16, width: 2 },
      },
      {
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines',
        name: 'FP8',
        line: { color: this.colors.fp8, width: 2 },
      },
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
          { range: [750, 1000], color: '#1f2937' },
        ],
      },
    };

    const gaugeLayout = {
      paper_bgcolor: '#1f2937',
      font: { color: '#9ca3af', family: 'Inter, sans-serif' },
      margin: { t: 0, b: 0, l: 0, r: 0 },
      height: 130,
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
          { range: [1.5, 2.0], color: '#1f2937' },
        ],
      },
      number: { suffix: ' GB/s', font: { size: 24, color: '#e5e7eb' } },
    };

    Plotly.newPlot(
      'gauge-bandwidth',
      [bandwidthGauge],
      gaugeLayout,
      gaugeConfig
    );
  }

  async togglePlayPause() {
    this.playing = !this.playing;

    if (this.playing) {
      // Load traces if they haven't been loaded yet
      if (Object.keys(this.traces).length === 0) {
        await this.loadTraces(this.currentCondition);
      }

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
    const FPS = 60;
    const frameInterval = 1000 / FPS;

    this.animationInterval = setInterval(() => {
      // Advance by (frameInterval * speed) seconds of simulation time
      // frameInterval is in ms, convert to seconds, then multiply by speed
      const deltaTime = (frameInterval / 1000) * this.speed;
      this.currentTime += deltaTime;

      // Check if we've reached the end
      if (this.currentTime >= this.maxTime) {
        this.currentTime = this.maxTime;
        this.updateAtTime(this.currentTime);
        this.togglePlayPause();
        return;
      }

      this.updateAtTime(this.currentTime);
    }, frameInterval);
  }

  clearAnimation() {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Update all graphs and metrics at a specific time
   * @param {number} targetTime - The target time in seconds
   */
  updateAtTime(targetTime) {
    // Update unified plot showing all precisions
    this.updateUnifiedPlot(targetTime);

    this.precisions.forEach(precision => {
      const trace = this.traces[precision];
      if (
        !trace ||
        !trace.trace ||
        !Array.isArray(trace.trace) ||
        trace.trace.length === 0
      )
        return;

      // Find the iteration at this time
      const iterIdx = this.findIterationAtTime(precision, targetTime);
      const pointData = trace.trace[iterIdx];

      // Update compact card metrics
      this.updateCompactCardMetrics(precision, {
        ...pointData,
        currentIteration: iterIdx,
        totalIterations: trace.trace.length,
      });

      // Update status
      this.updateStatus(precision, trace, iterIdx);
    });

    // Update comparison plot (all precisions at this time)
    this.updateComparisonAtTime(targetTime);

    // Update gauges (using FP32 as reference, or first available)
    const refPrecision = this.traces['fp32'] ? 'fp32' : this.precisions[0];
    const refTrace = this.traces[refPrecision];
    if (refTrace) {
      const refIterIdx = this.findIterationAtTime(refPrecision, targetTime);
      if (refTrace.trace[refIterIdx]) {
        this.updateGauges(refTrace.trace[refIterIdx]);
      }
    }

    // Update timeline
    this.updateTimeline();

    // Update comparison table and insights at end
    if (targetTime >= this.maxTime * 0.99) {
      this.updateComparison();
      this.generateInsights();
    }
  }

  updatePlot(precision, data) {
    const plotDiv = document.getElementById(`plot-${precision}`);

    // Filter out NaN values to prevent plotting issues
    const validData = data.filter(
      d =>
        !isNaN(d.relative_error) &&
        isFinite(d.relative_error) &&
        d.relative_error > 0
    );

    const update = {
      x: [validData.map(d => d.cumulative_time)], // Changed from iteration to cumulative_time
      y: [validData.map(d => Math.max(d.relative_error, 1e-12))], // Clamp to avoid log(0)
    };

    Plotly.restyle(plotDiv, update, [0]);
  }

  updateComparisonAtTime(targetTime) {
    const fp64Trace = this.traces['fp64'];
    if (!fp64Trace || !fp64Trace.trace) return;

    const comparePrecisions = ['fp32', 'fp16', 'fp8'];
    const updates = { x: [], y: [] };

    comparePrecisions.forEach((precision, _index) => {
      const trace = this.traces[precision];
      if (!trace || !trace.trace) {
        updates.x.push([]);
        updates.y.push([]);
        return;
      }

      // Find max iteration for this precision at targetTime
      const maxIterIdx = this.findIterationAtTime(precision, targetTime);
      const data = [];

      // Calculate relative difference between eigenvalues for each iteration up to maxIterIdx
      for (let i = 0; i <= maxIterIdx; i++) {
        const currentTime = trace.trace[i].cumulative_time;

        // Find FP64 iteration at the same time
        const fp64IterIdx = this.findIterationAtTime('fp64', currentTime);
        const fp64Eigenvalue = fp64Trace.trace[fp64IterIdx]?.eigenvalue;
        const precisionEigenvalue = trace.trace[i]?.eigenvalue;

        if (
          fp64Eigenvalue &&
          precisionEigenvalue &&
          !isNaN(fp64Eigenvalue) &&
          !isNaN(precisionEigenvalue) &&
          isFinite(fp64Eigenvalue) &&
          isFinite(precisionEigenvalue) &&
          fp64Eigenvalue !== 0
        ) {
          const relativeError =
            Math.abs(precisionEigenvalue - fp64Eigenvalue) /
            Math.abs(fp64Eigenvalue);
          data.push({
            time: currentTime, // Changed from iteration to time
            relativeError: Math.max(relativeError, 1e-12), // Clamp minimum for log scale
          });
        }
      }

      updates.x.push(data.map(d => d.time)); // Changed from iteration to time
      updates.y.push(data.map(d => d.relativeError));
    });

    Plotly.restyle('plot-comparison', updates, [0, 1, 2]);
  }

  updateMetrics(precision, iterData) {
    if (!iterData) return;

    // Display iteration count as "currentIteration / totalIterations"
    const iterText =
      iterData.currentIteration !== undefined &&
      iterData.totalIterations !== undefined
        ? `${iterData.currentIteration} / ${iterData.totalIterations}`
        : iterData.iteration || '0';

    document.getElementById(`iter-${precision}`).textContent = iterText;
    document.getElementById(`eigenvalue-${precision}`).textContent =
      this.formatEigenvalue(iterData.eigenvalue);
    document.getElementById(`error-${precision}`).textContent =
      this.formatError(iterData.relative_error);
    document.getElementById(`time-${precision}`).textContent = this.formatTime(
      iterData.cumulative_time
    );
    document.getElementById(`flops-${precision}`).textContent =
      this.formatFlops(iterData.theoretical_flops);
    document.getElementById(`bandwidth-${precision}`).textContent =
      this.formatBandwidth(iterData.theoretical_bandwidth_gbps);
  }

  updateCompactCardMetrics(precision, iterData) {
    if (!iterData) return;

    // Update compact card error and time
    const errorEl = document.getElementById(`error-${precision}-compact`);
    const timeEl = document.getElementById(`time-${precision}-compact`);

    if (errorEl) {
      errorEl.textContent = this.formatError(iterData.relative_error);
    }
    if (timeEl) {
      timeEl.textContent = this.formatTime(iterData.cumulative_time);
    }
  }

  updateSpeedupDisplays() {
    // Calculate theoretical speedup based on memory bandwidth (dtype_bytes ratio)
    // This represents hardware advantage: smaller data types = higher throughput
    const fp64Bytes = this.traces['fp64']?.metadata?.dtype_bytes;
    if (!fp64Bytes) return;

    this.precisions.forEach(precision => {
      const trace = this.traces[precision];
      if (!trace || !trace.metadata) return;

      const precisionBytes = trace.metadata.dtype_bytes;

      // Theoretical speedup = FP64 bytes / precision bytes
      // This reflects memory bandwidth advantage (e.g., 8 bytes / 1 byte = 8× for FP8)
      const speedup = fp64Bytes / precisionBytes;

      // Find card by looking for the precision name heading
      const cards = document.querySelectorAll('.bg-gradient-to-br');
      for (const card of cards) {
        const heading = card.querySelector('h3');
        if (heading && heading.textContent.trim() === precision.toUpperCase()) {
          const speedupEl = card.querySelector('.text-4xl');
          if (speedupEl) {
            speedupEl.textContent = speedup.toFixed(1) + '×';
          }
          break;
        }
      }
    });
  }

  updateUnifiedPlot(targetTime) {
    const updates = { x: [], y: [] };

    this.precisions.forEach((precision, index) => {
      const trace = this.traces[precision];
      if (!trace || !trace.trace) {
        updates.x.push([]);
        updates.y.push([]);
        return;
      }

      const maxIterIdx = this.findIterationAtTime(precision, targetTime);
      const visibleData = trace.trace
        .slice(0, maxIterIdx + 1)
        .filter(d => d.relative_error > 0 && isFinite(d.relative_error))
        .map(d => ({
          time: d.cumulative_time,
          error: Math.max(d.relative_error, 1e-16), // Clamp for log scale
        }));

      updates.x.push(visibleData.map(d => d.time));
      updates.y.push(visibleData.map(d => d.error));
    });

    Plotly.restyle('plot-unified', updates, [0, 1, 2, 3]);
  }

  toggleHighlight(precision) {
    if (this.highlightedPrecision === precision) {
      // Unhighlight - restore all lines to normal
      this.highlightedPrecision = null;
      const lineUpdates = {
        'line.width': [3, 3, 3, 3],
        'line.dash': ['solid', 'solid', 'solid', 'solid'],
        opacity: [1, 1, 1, 1],
      };
      Plotly.restyle('plot-unified', lineUpdates, [0, 1, 2, 3]);

      // Remove card highlighting
      this.precisions.forEach(p => {
        const cardColors = {
          fp64: 'blue',
          fp32: 'green',
          fp16: 'yellow',
          fp8: 'orange',
        };
        const card = document.querySelector(
          `[class*="border-${cardColors[p]}-500"]`
        );
        if (card) {
          card.style.transform = '';
          card.style.boxShadow = '';
        }
      });
    } else {
      // Highlight selected precision
      this.highlightedPrecision = precision;
      const precisionIndex = this.precisions.indexOf(precision);

      const lineUpdates = {
        'line.width': [1, 1, 1, 1],
        'line.dash': ['dot', 'dot', 'dot', 'dot'],
        opacity: [0.3, 0.3, 0.3, 0.3],
      };

      // Make selected precision prominent
      lineUpdates['line.width'][precisionIndex] = 5;
      lineUpdates['line.dash'][precisionIndex] = 'solid';
      lineUpdates.opacity[precisionIndex] = 1;

      Plotly.restyle('plot-unified', lineUpdates, [0, 1, 2, 3]);

      // Highlight corresponding card
      const cardColors = {
        fp64: 'blue',
        fp32: 'green',
        fp16: 'yellow',
        fp8: 'orange',
      };
      this.precisions.forEach(p => {
        const card = document.querySelector(
          `[class*="border-${cardColors[p]}-500"]`
        );
        if (card) {
          if (p === precision) {
            card.style.transform = 'translateY(-8px) scale(1.05)';
            card.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.7)';
          } else {
            card.style.transform = '';
            card.style.boxShadow = '';
          }
        }
      });
    }
  }

  updateStatus(precision, trace, frameIndex) {
    const statusEl = document.getElementById(`status-${precision}`);

    if (
      !trace ||
      !trace.trace ||
      !Array.isArray(trace.trace) ||
      !trace.metadata
    )
      return;

    if (frameIndex >= trace.trace.length - 1) {
      // Check if threshold was reached
      if (trace.metadata.threshold_reached) {
        statusEl.textContent = 'IEEE754 Threshold';
        statusEl.className =
          'px-3 py-1 rounded-full text-xs font-medium bg-purple-900 text-purple-200';
      } else if (trace.metadata.converged) {
        statusEl.textContent = 'Converged';
        statusEl.className =
          'px-3 py-1 rounded-full text-xs font-medium status-converged';
      } else {
        statusEl.textContent = 'Max Iterations';
        statusEl.className =
          'px-3 py-1 rounded-full text-xs font-medium status-failed';
      }
    } else {
      statusEl.textContent = 'Running';
      statusEl.className =
        'px-3 py-1 rounded-full text-xs font-medium status-running';
    }
  }

  updateGauges(iterData) {
    if (!iterData) return;

    // Update FLOPS gauge
    Plotly.restyle(
      'gauge-flops',
      {
        value: [iterData.theoretical_flops / 1e6], // Convert to MFLOPS
      },
      [0]
    );

    // Update bandwidth gauge
    Plotly.restyle(
      'gauge-bandwidth',
      {
        value: [iterData.theoretical_bandwidth_gbps],
      },
      [0]
    );
  }

  updateTimeline() {
    // Calculate percentage based on time
    const percent =
      this.maxTime > 0 ? (this.currentTime / this.maxTime) * 100 : 0;
    document.getElementById('timeline').value = percent;

    // Update time display
    document.getElementById('currentTime').textContent =
      `${this.currentTime.toFixed(4)}s`;
    document.getElementById('maxTime').textContent = `${this.maxTime.toFixed(
      4
    )}s`;
  }

  updateComparison() {
    const tbody = document.getElementById('comparisonTableBody');
    tbody.innerHTML = '';

    const metrics = [
      {
        label: 'Iterations',
        key: 'total_iterations',
        format: v => v.toLocaleString(),
      },
      {
        label: 'Time (ms)',
        key: 'total_time_seconds',
        format: v => (v * 1000).toFixed(2),
      },
      {
        label: 'Time/Iter (ms)',
        key: 'time_per_iter',
        format: v => v.toFixed(3),
      },
      {
        label: 'Total Time (s)',
        key: 'total_time_seconds',
        format: v => v.toExponential(2),
      },
      {
        label: 'Final Error',
        key: 'final_error',
        format: v => this.formatError(v),
      },
      { label: 'Eigenvalue vs FP64', key: 'error_vs_fp64', format: v => v },
      {
        label: 'Avg FLOPS (M)',
        key: 'avg_flops',
        format: v => (v / 1e6).toFixed(1),
      },
      {
        label: 'Total FLOPS',
        key: 'total_ops',
        format: v => v.toExponential(2),
      },
      {
        label: 'Avg BW (GB/s)',
        key: 'avg_bandwidth_gbps',
        format: v => v.toFixed(2),
      },
      {
        label: 'Total BW',
        key: 'total_bytes',
        format: v => v.toExponential(2),
      },
      {
        label: 'IEEE754 ε',
        key: 'ieee754_threshold',
        format: v => this.formatError(v),
      },
      {
        label: 'IEEE754 Threshold',
        key: 'threshold_reached',
        format: v => (v ? '✓' : '✗'),
      },
    ];

    metrics.forEach(metric => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-700';

      let html = `<td class="py-2">${metric.label}</td>`;

      this.precisions.forEach(precision => {
        const trace = this.traces[precision];
        let value = '—';

        if (trace && trace.metadata && trace.summary) {
          if (
            metric.key === 'final_error' ||
            metric.key === 'threshold_reached' ||
            metric.key === 'ieee754_threshold'
          ) {
            value = metric.format(trace.metadata[metric.key]);
          } else if (metric.key === 'time_per_iter') {
            // Calculate average wall time per iteration in milliseconds
            if (trace.summary.total_iterations > 0) {
              const timePerIter =
                (trace.summary.total_time_seconds /
                  trace.summary.total_iterations) *
                1000;
              value = metric.format(timePerIter);
            }
          } else if (metric.key === 'error_vs_fp64') {
            // Calculate eigenvalue difference compared to FP64
            const fp64Trace = this.traces['fp64'];
            if (precision === 'fp64') {
              value = '—'; // FP64 baseline (no difference with itself)
            } else if (fp64Trace && fp64Trace.trace && trace.trace) {
              const fp64Eigenvalue =
                fp64Trace.trace[fp64Trace.trace.length - 1]?.eigenvalue;
              const precisionEigenvalue =
                trace.trace[trace.trace.length - 1]?.eigenvalue;
              if (
                fp64Eigenvalue &&
                precisionEigenvalue &&
                fp64Eigenvalue !== 0
              ) {
                const eigenvalueError =
                  Math.abs(precisionEigenvalue - fp64Eigenvalue) /
                  Math.abs(fp64Eigenvalue);
                value = this.formatError(eigenvalueError);
              }
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
    const validateTrace = t => t && t.summary && t.metadata;
    if (
      !validateTrace(fp64) ||
      !validateTrace(fp32) ||
      !validateTrace(fp16) ||
      !validateTrace(fp8)
    )
      return;

    // Speedup analysis
    const fp64Time = fp64.summary.total_time_seconds;
    const fp32Speedup = fp64Time / fp32.summary.total_time_seconds;
    const fp16Speedup = fp64Time / fp16.summary.total_time_seconds;
    const fp8Speedup = fp64Time / fp8.summary.total_time_seconds;

    insights.push(
      `<strong>⚡ Speedup:</strong> FP32 is ${fp32Speedup.toFixed(
        1
      )}× faster, FP16 is ${fp16Speedup.toFixed(
        1
      )}× faster, FP8 is ${fp8Speedup.toFixed(1)}× faster than FP64.`
    );

    // Accuracy analysis
    const fp32Error = fp32.metadata.final_error;
    const fp16Error = fp16.metadata.final_error;
    const fp8Error = fp8.metadata.final_error;

    // Eigenvalue comparison vs FP64
    const fp64Eigenvalue = fp64.trace[fp64.trace.length - 1]?.eigenvalue || 0;
    const fp32Eigenvalue = fp32.trace[fp32.trace.length - 1]?.eigenvalue || 0;
    const fp16Eigenvalue = fp16.trace[fp16.trace.length - 1]?.eigenvalue || 0;
    const fp8Eigenvalue = fp8.trace[fp8.trace.length - 1]?.eigenvalue || 0;

    const fp32EigenvalueError =
      fp64Eigenvalue !== 0
        ? Math.abs(fp32Eigenvalue - fp64Eigenvalue) / Math.abs(fp64Eigenvalue)
        : 0;
    const fp16EigenvalueError =
      fp64Eigenvalue !== 0
        ? Math.abs(fp16Eigenvalue - fp64Eigenvalue) / Math.abs(fp64Eigenvalue)
        : 0;
    const fp8EigenvalueError =
      fp64Eigenvalue !== 0
        ? Math.abs(fp8Eigenvalue - fp64Eigenvalue) / Math.abs(fp64Eigenvalue)
        : 0;

    insights.push(
      `<strong>📊 Eigenvalue vs FP64:</strong> FP32 differs by ${this.formatError(
        fp32EigenvalueError
      )}, FP16 by ${this.formatError(
        fp16EigenvalueError
      )}, FP8 by ${this.formatError(fp8EigenvalueError)} from FP64 baseline.`
    );

    if (fp32Error < 1e-5) {
      insights.push(
        `<strong>✓ FP32 Performance:</strong> Achieves excellent accuracy (${this.formatError(
          fp32Error
        )}) with significant speedup — ideal for most applications.`
      );
    }

    if (fp16Error < 1e-2) {
      insights.push(
        `<strong>⚠️ FP16 Tradeoff:</strong> Final error of ${this.formatError(
          fp16Error
        )} represents a ${fp16Speedup.toFixed(
          1
        )}× speedup. Acceptable for many ML inference tasks.`
      );
    } else {
      insights.push(
        `<strong>❌ FP16 Limitation:</strong> Error of ${this.formatError(
          fp16Error
        )} may be too high for precision-critical applications.`
      );
    }

    if (fp8Error > 0.1) {
      insights.push(
        `<strong>🔴 FP8 Challenge:</strong> Error of ${this.formatError(
          fp8Error
        )} (${(fp8Error * 100).toFixed(
          1
        )}%) shows severe degradation. FP8 best suited for inference with error-tolerant models.`
      );
    }

    // Convergence analysis
    const fp64Iters = fp64.summary.total_iterations;
    const fp32Iters = fp32.summary.total_iterations;

    insights.push(
      `<strong>🔄 Convergence:</strong> FP64 took ${fp64Iters} iterations, FP32 took ${fp32Iters} iterations. Lower precision can affect convergence behavior.`
    );

    // Hardware relevance
    insights.push(
      "<strong>💡 AI Hardware Context:</strong> NVIDIA's Hopper (H100) achieves 2000 TFLOPS in FP8 vs 60 TFLOPS in FP16, making precision choice critical for performance."
    );

    insightsPanel.innerHTML = insights.map(i => `<p>${i}</p>`).join('');
  }

  seekToPercent(percent) {
    this.currentTime = (percent / 100) * this.maxTime;
    this.updateAtTime(this.currentTime);
  }

  reset() {
    this.playing = false;
    this.currentTime = 0;
    this.clearAnimation();

    document.getElementById('playIcon').textContent = '▶';
    document.getElementById('playText').textContent = 'Play';

    this.updateAtTime(0);
    this.updateComparison();
    this.generateInsights();
  }

  updateUI() {
    // Initial update
    this.updateAtTime(0);
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
    if (isNaN(timeSeconds) || !isFinite(timeSeconds) || timeSeconds < 0)
      return '—';
    if (timeSeconds < 1e-6) return `${(timeSeconds * 1e9).toFixed(1)}ns`;
    if (timeSeconds < 1e-3) return `${(timeSeconds * 1e6).toFixed(1)}μs`;
    if (timeSeconds < 1) return `${(timeSeconds * 1e3).toFixed(2)}ms`;
    return `${timeSeconds.toFixed(3)}s`;
  }

  formatBandwidth(bandwidthGbps) {
    if (!bandwidthGbps || bandwidthGbps === 0) return '—';
    if (bandwidthGbps < 0.001) return `${(bandwidthGbps * 1000).toFixed(2)}M`;
    if (bandwidthGbps < 1) return `${(bandwidthGbps * 1000).toFixed(1)}M`;
    return `${bandwidthGbps.toFixed(2)}G`;
  }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new PrecisionDashboard();
});
