# PrecisionLens Web Dashboard

Interactive visualization of floating-point precision impact on numerical algorithms.

## Features

- **Live Replay**: Watch the power method converge across FP64, FP32, FP16, and FP8 side-by-side
- **Performance Metrics**: Real-time FLOPS and memory bandwidth gauges
- **Interactive Controls**: Play/pause, speed control, timeline scrubber
- **Comparison Table**: Final metrics comparison across all precisions
- **Auto-generated Insights**: Key takeaways about precision-performance tradeoffs

## Local Testing

```bash
# Start a local server
cd web
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

## Deployment to GitHub Pages

1. Ensure all trace files are in `web/traces/`
2. Configure GitHub Pages to serve from `/web` directory
3. Visit: `https://[username].github.io/precision-lens/`

## Tech Stack

- **Plotly.js** - Interactive charts
- **Tailwind CSS** - Modern styling
- **Vanilla JavaScript** - Zero dependencies, fast loading
- **JSON Traces** - Pre-generated execution data

## Files

- `index.html` - Main dashboard page
- `dashboard.js` - Visualization logic and interactivity
- `style.css` - Custom styling
- `traces/` - Pre-generated trace data (12 files)
- `assets/` - Additional resources

## Browser Compatibility

Modern browsers with ES6+ support:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Total page size: ~2.5MB (including all traces)
- Load time: < 2s on standard connection
- Smooth 60 FPS animations
- No backend required - fully static

## Educational Focus

This dashboard is designed to clearly demonstrate:

1. How reduced precision affects convergence
2. Speedup vs accuracy tradeoffs
3. Relevance to modern AI accelerators (NVIDIA Hopper, AMD MI300)
4. Practical implications for algorithm design

Perfect for sharing on LinkedIn or in technical presentations!
