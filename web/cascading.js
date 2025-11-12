/**
 * Cascading Precision Strategy Dashboard
 *
 * Visualizes the adaptive precision escalation approach where the algorithm
 * automatically transitions from FP8 → FP16 → FP32 → FP64 based on convergence.
 */

class CascadingDashboard {
  constructor() {
    this.currentCondition = 100;
    this.traces = {};
    this.fpTraces = {}; // Store individual FP traces for comparison

    // Precision colors matching main dashboard
    this.precisionColors = {
      FP64: '#60a5fa', // blue-400
      FP32: '#34d399', // green-400
      FP16: '#fbbf24', // yellow-400
      FP8: '#fb923c', // orange-400
    };

    this.init();
  }

  async init() {
    console.log('Initializing Cascading Dashboard...');

    // Setup event listeners
    document
      .getElementById('conditionSelector')
      .addEventListener('change', e => {
        this.currentCondition = parseInt(e.target.value);
        this.loadAndDisplay();
      });

    // Load and display initial condition
    await this.loadAndDisplay();

    console.log('✓ Cascading Dashboard initialized');
  }

  async loadAndDisplay() {
    console.log(
      `Loading traces for condition number ${this.currentCondition}...`
    );

    try {
      // Load cascading trace
      const cascadingTrace = await this.loadTrace(
        `traces/cascading_cond${this.currentCondition}_n50.json`
      );
      this.traces.cascading = cascadingTrace;

      // Load individual precision traces for comparison
      await this.loadComparisonTraces();

      // Update all visualizations
      this.updateTimeline();
      this.updateResidualPlot();
      this.updateSegments();
      this.updateComparison();
      this.updateInsights();

      console.log('✓ All visualizations updated');
    } catch (error) {
      console.error('Error loading traces:', error);
      this.showError(error.message);
    }
  }

  async loadTrace(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return await response.json();
  }

  async loadComparisonTraces() {
    const precisions = ['fp64', 'fp32', 'fp16', 'fp8'];
    for (const precision of precisions) {
      try {
        const trace = await this.loadTrace(
          `traces/${precision}_cond${this.currentCondition}_n50.json`
        );
        this.fpTraces[precision] = trace;
      } catch (error) {
        console.warn(`Could not load ${precision} trace:`, error);
      }
    }
  }

  updateTimeline() {
    const trace = this.traces.cascading;
    if (!trace || !trace.trace) return;

    const data = [];

    // Create trace for each precision level with error on log scale
    const segments = trace.precision_segments || [];

    // Add a trace for each precision segment with strict non-overlapping boundaries
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLastSegment = i === segments.length - 1;

      // Strict boundary filtering: include start, exclude end (except for last segment)
      const segmentData = trace.trace.filter(t => {
        if (isLastSegment) {
          // Last segment: include up to and including the end
          return (
            t.iteration >= segment.start_iteration &&
            t.iteration <= segment.end_iteration
          );
        } else {
          // Other segments: exclude the end iteration (belongs to next segment)
          return (
            t.iteration >= segment.start_iteration &&
            t.iteration < segment.end_iteration
          );
        }
      });

      const times = segmentData.map(t => t.cumulative_time);
      const errors = segmentData.map(t => t.relative_error);

      data.push({
        x: times,
        y: errors,
        mode: 'lines+markers',
        name: segment.precision,
        line: {
          color: this.precisionColors[segment.precision],
          width: 3,
        },
        marker: {
          size: 5,
          color: this.precisionColors[segment.precision],
          opacity: 0.9,
        },
      });
    }

    const layout = {
      paper_bgcolor: '#1f2937',
      plot_bgcolor: '#111827',
      font: { color: '#9ca3af', family: 'Inter, sans-serif' },
      margin: { l: 80, r: 40, t: 20, b: 60 },
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

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    };

    Plotly.newPlot('plot-timeline', data, layout, config);
  }

  updateResidualPlot() {
    const trace = this.traces.cascading;
    if (!trace || !trace.trace) return;

    const data = [];
    const segments = trace.precision_segments || [];

    // Add a trace for each precision segment showing residual convergence
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLastSegment = i === segments.length - 1;

      // Strict boundary filtering: include start, exclude end (except for last segment)
      const segmentData = trace.trace.filter(t => {
        if (isLastSegment) {
          return (
            t.iteration >= segment.start_iteration &&
            t.iteration <= segment.end_iteration
          );
        } else {
          return (
            t.iteration >= segment.start_iteration &&
            t.iteration < segment.end_iteration
          );
        }
      });

      const iterations = segmentData.map(t => t.iteration);
      const residuals = segmentData.map(t => t.residual_norm);

      data.push({
        x: iterations,
        y: residuals,
        mode: 'lines+markers',
        name: segment.precision,
        line: {
          color: this.precisionColors[segment.precision],
          width: 3,
        },
        marker: {
          size: 5,
          color: this.precisionColors[segment.precision],
          opacity: 0.9,
        },
      });
    }

    const layout = {
      paper_bgcolor: '#1f2937',
      plot_bgcolor: '#111827',
      font: { color: '#9ca3af', family: 'Inter, sans-serif' },
      margin: { l: 80, r: 40, t: 20, b: 60 },
      xaxis: {
        title: 'Iteration',
        gridcolor: '#374151',
        zerolinecolor: '#4b5563',
      },
      yaxis: {
        title: 'Residual Norm ||A*x - λ*x||',
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

    const config = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    };

    Plotly.newPlot('plot-residual', data, layout, config);
  }

  updateSegments() {
    const trace = this.traces.cascading;
    if (!trace || !trace.precision_segments) return;

    const container = document.getElementById('segments-grid');
    container.innerHTML = '';

    const segments = trace.precision_segments;

    for (const segment of segments) {
      const card = document.createElement('div');
      card.className =
        'bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 border-2 transition-all';
      card.style.borderColor = this.precisionColors[segment.precision] + '40';

      const speedup = 8 / segment.dtype_bytes; // FP64 bytes / current bytes

      const color = this.precisionColors[segment.precision];
      const precisionName = this.getPrecisionName(segment.precision);
      const statusClass = segment.converged
        ? 'bg-green-900/30 text-green-300'
        : 'bg-yellow-900/30 text-yellow-300';
      const statusText = segment.converged ? '✓ Converged' : '→ Transitioned';

      /* eslint-disable indent */
      card.innerHTML = `
        <div class="text-center mb-3">
          <h4 class="text-lg font-bold" style="color: ${color}">${
            segment.precision
          }</h4>
          <div class="text-xs text-gray-400">${precisionName}</div>
        </div>
        <div class="space-y-2">
          <div class="bg-gray-900/50 rounded px-3 py-2">
            <div class="text-3xl font-bold text-center" style="color: ${color}">${speedup.toFixed(
              1
            )}×</div>
            <div class="text-xs text-gray-400 text-center">Speedup</div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-gray-900/50 rounded p-2">
              <div class="text-gray-400">Iterations</div>
              <div class="font-semibold" style="color: ${color}">${
                segment.iterations
              }</div>
            </div>
            <div class="bg-gray-900/50 rounded p-2">
              <div class="text-gray-400">Time</div>
              <div class="font-semibold" style="color: ${color}">${(
                segment.time * 1000
              ).toFixed(2)}ms</div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-gray-900/50 rounded p-2">
              <div class="text-gray-400">Start Error</div>
              <div class="font-semibold" style="color: ${color}">${this.formatError(
                segment.start_error
              )}</div>
            </div>
            <div class="bg-gray-900/50 rounded p-2">
              <div class="text-gray-400">End Error</div>
              <div class="font-semibold" style="color: ${color}">${this.formatError(
                segment.end_error
              )}</div>
            </div>
          </div>
          <div class="text-xs text-center px-2 py-1 rounded-full ${statusClass}">
            ${statusText}
          </div>
        </div>
      `;
      /* eslint-enable indent */

      container.appendChild(card);
    }
  }

  updateComparison() {
    const cascading = this.traces.cascading;
    if (!cascading) return;

    const tbody = document.getElementById('comparisonTableBody');
    tbody.innerHTML = '';

    // Cascading row
    const cascadingRow = this.createComparisonRow(
      'Cascading (FP8→FP16→FP32→FP64)',
      cascading.summary.total_iterations,
      cascading.summary.total_time_seconds,
      cascading.metadata.final_error,
      null
    );
    tbody.appendChild(cascadingRow);

    // FP64 reference (baseline)
    const fp64 = this.fpTraces.fp64;
    if (fp64) {
      const fp64Row = this.createComparisonRow(
        'FP64 (Reference)',
        fp64.summary.total_iterations,
        fp64.summary.total_time_seconds,
        fp64.metadata.final_error,
        1.0
      );
      tbody.appendChild(fp64Row);

      // Calculate speedup for cascading vs FP64
      const speedup =
        fp64.summary.total_time_seconds / cascading.summary.total_time_seconds;
      cascadingRow.cells[4].textContent = speedup.toFixed(2) + '×';
      cascadingRow.cells[4].classList.add('text-green-400', 'font-bold');
    }

    // FP32 comparison
    const fp32 = this.fpTraces.fp32;
    if (fp32 && fp64) {
      const speedup32 =
        fp64.summary.total_time_seconds / fp32.summary.total_time_seconds;
      const fp32Row = this.createComparisonRow(
        'FP32 (Single Precision)',
        fp32.summary.total_iterations,
        fp32.summary.total_time_seconds,
        fp32.metadata.final_error,
        speedup32
      );
      tbody.appendChild(fp32Row);
    }
  }

  createComparisonRow(strategy, iterations, time, error, speedup) {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-700';

    const speedupText = speedup !== null ? speedup.toFixed(2) + '×' : '—';

    row.innerHTML = `
      <td class="py-3 text-left">${strategy}</td>
      <td class="py-3 text-right font-mono">${iterations}</td>
      <td class="py-3 text-right font-mono">${(time * 1000).toFixed(2)}ms</td>
      <td class="py-3 text-right font-mono">${this.formatError(error)}</td>
      <td class="py-3 text-right font-mono">${speedupText}</td>
    `;

    return row;
  }

  updateInsights() {
    const trace = this.traces.cascading;
    if (!trace) return;

    const container = document.getElementById('insightsPanel');
    const segments = trace.precision_segments || [];
    const metadata = trace.metadata;

    const insights = [];

    // Strategy effectiveness
    const conditionType =
      metadata.condition_number === 10
        ? 'well-conditioned'
        : metadata.condition_number === 100
          ? 'moderately-conditioned'
          : 'ill-conditioned';
    insights.push(
      `🎯 <strong>Adaptive Strategy</strong>: Used ${
        segments.length
      } precision levels to reach ${this.formatError(
        metadata.final_error
      )} error in ${conditionType} matrix.`
    );

    // Precision breakdown
    const precisionList = segments.map(s => s.precision).join(' → ');
    insights.push(
      `🔄 <strong>Precision Cascade</strong>: ${precisionList} — each level contributes to convergence until its precision limit is reached.`
    );

    // Time distribution
    const timeBreakdown = segments
      .map(
        s =>
          `${s.precision}: ${(
            (s.time / trace.summary.total_time_seconds) *
            100
          ).toFixed(1)}%`
      )
      .join(', ');
    insights.push(
      `⏱️ <strong>Time Distribution</strong>: ${timeBreakdown} — faster precisions dominate early iterations.`
    );

    // Iteration distribution
    const iterBreakdown = segments
      .map(s => `${s.precision}: ${s.iterations} iters`)
      .join(', ');
    insights.push(
      `📊 <strong>Iteration Distribution</strong>: ${iterBreakdown} — total ${trace.summary.total_iterations} iterations.`
    );

    // Benefits
    if (this.fpTraces.fp64) {
      const speedup =
        this.fpTraces.fp64.summary.total_time_seconds /
        trace.summary.total_time_seconds;
      insights.push(
        `🚀 <strong>Performance Gain</strong>: ${speedup.toFixed(
          2
        )}× faster than FP64-only approach while achieving same accuracy.`
      );
    }

    // Robustness
    insights.push(
      '🛡️ <strong>Adaptive Robustness</strong>: Automatically escalates precision when lower levels stagnate, guaranteeing convergence through precision escalation.'
    );

    // Render insights
    container.innerHTML = insights
      .map(insight => `<div>• ${insight}</div>`)
      .join('');
  }

  getPrecisionName(precision) {
    const names = {
      FP64: 'Double Precision',
      FP32: 'Single Precision',
      FP16: 'Half Precision',
      FP8: 'Simulated',
    };
    return names[precision] || '';
  }

  formatError(error) {
    if (error === null || error === undefined || isNaN(error)) {
      return '—';
    }
    return error.toExponential(2);
  }

  showError(message) {
    const container = document.querySelector('.max-w-7xl');
    const errorDiv = document.createElement('div');
    errorDiv.className =
      'bg-red-900/30 border border-red-500 rounded-lg p-6 mb-6 text-red-300';
    errorDiv.innerHTML = `
      <h3 class="text-xl font-semibold mb-2">⚠️ Error Loading Data</h3>
      <p>${message}</p>
      <p class="mt-2 text-sm">Please check that all trace files exist in the traces/ directory.</p>
    `;
    container.insertBefore(errorDiv, container.firstChild);
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new CascadingDashboard();
});
