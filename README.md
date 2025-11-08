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

### View Interactive Dashboard

```bash
cd web
python3 -m http.server 8000
# Open http://localhost:8000
```

### Run Static Analysis

```bash
pip install -r requirements.txt
python algorithms/power_method/study.py
```

### Generate New Traces

```bash
python scripts/generate_traces.py
```

## 📊 Key Findings

Using the power method for eigenvalue computation (matrix size: 50):

| Precision | Speedup | Final Error | Use Case |
|-----------|---------|-------------|----------|
| **FP64** | 1.0× | ~10⁻¹⁰ | Reference baseline |
| **FP32** | 4-5× | ~10⁻⁶ | Most scientific computing |
| **FP16** | 20× | ~10⁻² | ML training, well-conditioned problems |
| **FP8** | 70-80× | ~10-20% | ML inference with error tolerance |

**Insight**: FP32 achieves 4-5× speedup with negligible accuracy loss for most applications. FP8 shows dramatic speedup but requires careful validation.

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
