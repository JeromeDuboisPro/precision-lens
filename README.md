# PrecisionLens

Investigating how reduced floating-point precision (FP32→FP16→FP8) affects numerical algorithms.

## Why

Modern accelerators use lower precision for speed. But when do algorithms break?

## Current Focus

Power method eigenvalue computation across precision formats.

## Run
```bash
pip install numpy matplotlib
python algorithms/power_method/study.py
```

## Results

See `/results` for convergence plots.

## License

MIT

---
*Exploring the precision-accuracy frontier in numerical computing*
