# PrecisionLens

**Visualizing precision-performance tradeoffs in numerical computing**

Modern AI accelerators like NVIDIA's Hopper architecture leverage reduced floating-point precision (FP8/FP16) for massive throughput gains. But when do numerical algorithms break? PrecisionLens provides interactive visualizations to explore this frontier.

## 🎯 Interactive Dashboard

**[Try the live demo →](#)** *(Deploy to GitHub Pages)*

Watch the power method algorithm converge across FP64, FP32, FP16, and FP8 in real-time:
- ⚡ Side-by-side convergence comparison
- 📊 Performance metrics (FLOPS, memory bandwidth)
- 🎮 Interactive replay controls
- 📈 Auto-generated insights

![Dashboard Preview](web/assets/preview.png)

## 🚀 Quick Start

### Option 1: Dev Container (Recommended for Development)

Get a fully configured environment with Python 3.12, Node.js 20, and all linting tools:

```bash
# Open in Claude Code, VSCode, or GitHub Codespaces
# Click "Reopen in Container" when prompted
```

✅ Matches CI/CD environment exactly
✅ Pre-commit hooks auto-installed
✅ All dependencies ready to go

See [.devcontainer/README.md](.devcontainer/README.md) for details.

### Option 2: Manual Setup

#### View Interactive Dashboard

```bash
cd web
python3 -m http.server 8000
# Open http://localhost:8000
```

#### Run Static Analysis

```bash
pip install -r requirements.txt
python algorithms/power_method/study.py
```

#### Generate New Traces

```bash
python scripts/generate_traces.py
```

## 📊 Key Findings

Using the power method for eigenvalue computation (matrix size: 50):

| Precision | Theoretical Speedup | Convergence Behavior | Use Case |
|-----------|-------------------|----------------------|----------|
| **FP64** | 1.0× | Highest accuracy (~10⁻⁹) | Reference baseline |
| **FP32** | 2.0× | Good accuracy (~10⁻⁸) | Most scientific computing |
| **FP16** | 4.0× | Moderate accuracy (~10⁻⁴) | ML training, well-conditioned problems |
| **FP8** | 8.0× | Limited accuracy (~10⁻²) | ML inference with error tolerance |

**Insight**: Speedup reflects theoretical memory bandwidth advantage (dtype size ratio). Lower precision trades accuracy for throughput - FP8 converges in 3 iterations vs FP64's 500, but stops at 9% error vs 10⁻⁹. Perfect for demonstrating precision-performance frontiers in GPU math libraries.

## 🛠️ Project Structure

```
precision-lens/
├── algorithms/power_method/
│   ├── study.py           # Original batch analysis
│   ├── instrumented.py    # Detailed performance tracing
│   └── traces/            # Generated execution traces
├── scripts/
│   └── generate_traces.py # Batch trace generation
├── web/                    # Interactive dashboard
│   ├── index.html
│   ├── dashboard.js
│   └── traces/            # Pre-generated data
└── results/               # Static plots
```

## 💡 Educational Applications

Perfect for:
- Understanding mixed-precision training/inference
- Teaching numerical stability concepts
- Demonstrating hardware-algorithm co-design
- Portfolio projects for ML/HPC roles

## 🎓 Technical Details

**Algorithm**: Power method for dominant eigenvalue computation

**Precision Formats**:
- FP64: IEEE 754 double precision
- FP32: IEEE 754 single precision
- FP16: IEEE 754 half precision
- FP8: Simulated via mantissa quantization

**Performance Metrics**:
- Theoretical FLOPS: 2n² + n operations per iteration
- Memory bandwidth: (n² + 2n) × bytes per element
- Convergence: Relative error vs iteration count

## 🚀 Advanced Algorithms

### Cascading Precision Strategy

Instead of committing to a single precision, **cascade through precisions** dynamically:

**FP8 → FP16 → FP32 → FP64**

- Start fast with FP8 for rapid initial convergence
- Transition to FP16 when IEEE754 threshold reached (relative error < 10⁻¹)
- Escalate to FP32/FP64 only when higher accuracy needed
- Carry eigenvector state across transitions for efficiency

**Benefits**:
- **Adaptive robustness**: Guaranteed convergence via precision escalation
- **Time-to-solution**: Minimize wall-clock time for target accuracy
- **Hardware efficiency**: Maximize throughput in early iterations

### Collaborative Multi-Precision Ensemble

Run **all four precisions in parallel** with competitive collaboration:

**Architecture**:
- Each solver (FP8/16/32/64) runs independently with shared state
- Solvers asynchronously exchange best eigenvalue/eigenvector estimates
- Fast precisions (FP8/16) explore search space; slower ones (FP32/64) refine
- **Competitive convergence**: Best estimate at each step drives the ensemble

**Synchronization**:
- Solvers compete for "ground truth" - most accurate estimate wins
- Lower precisions adjust search direction based on higher-precision feedback
- Converge when all solvers agree within tolerance threshold

**Research Questions**:
- Can FP8's exploration speed + FP64's accuracy outperform single-precision?
- Optimal weighting strategies for ensemble predictions?
- Communication overhead vs convergence acceleration tradeoffs?

These algorithms explore the **frontier of mixed-precision numerical computing** - a critical area for modern GPU math libraries and AI accelerator design.

## 🔗 Relevant Context

Modern AI accelerators:
- **NVIDIA H100**: 2000 TFLOPS (FP8) vs 60 TFLOPS (FP16)
- **AMD MI300X**: 1300 TFLOPS (FP8) vs 82 TFLOPS (FP16)
- **Precision choice = critical performance factor**

This tool demonstrates these tradeoffs interactively.

## 📜 License

MIT

---

*Built to explore the precision-performance frontier shaping modern AI hardware*
