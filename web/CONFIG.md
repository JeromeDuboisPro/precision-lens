# Web Frontend Configuration

## Overview

The web frontend uses a centralized configuration file (`web/config.json`) to manage trace file settings. This ensures consistency between the web dashboard and Python scripts that generate trace files.

## Configuration File

**Location:** `web/config.json`

**Structure:**

```json
{
  "matrixSize": 50,
  "conditionNumbers": [10, 100, 1000],
  "precisions": ["fp64", "fp32", "fp16", "fp8"],
  "tracesDirectory": "traces"
}
```

### Fields

- **matrixSize** (int): The matrix size (n) used for trace generation. This determines the `n` value in trace filenames (`{precision}_cond{N}_n{matrixSize}.json`).

- **conditionNumbers** (array): List of condition numbers to test. These are the values selectable in the web dashboard dropdown.

- **precisions** (array): List of floating-point precisions to compare. Should match the precision types implemented in the algorithm.

- **tracesDirectory** (string): Directory name (relative to `web/`) where trace files are stored.

## Usage

### JavaScript (Web Dashboard)

The dashboard automatically loads `config.json` on initialization:

```javascript
// Automatically loaded in dashboard.js
const response = await fetch('config.json');
const config = await response.json();

// Used to construct trace filenames
const filename = `${precision}_cond${conditionNumber}_n${config.matrixSize}.json`;
```

### Python (Scripts and Tests)

Use the `web.config` module to load configuration:

```python
from web.config import load_config, get_trace_filename

# Load configuration
config = load_config()
matrix_size = config['matrixSize']
condition_numbers = config['conditionNumbers']

# Generate trace filename
filename = get_trace_filename('fp32', 100)  # fp32_cond100_n50.json
```

## Generating Traces

To generate trace files with the configured settings, run:

```bash
python scripts/generate_traces.py
```

This script:

1. Reads `web/config.json`
2. Generates trace files for all precision × condition number combinations
3. Saves files to `web/traces/` using the configured matrix size
4. Also generates larger traces (n=1000) for the algorithms directory

## Changing Configuration

To change the matrix size or other settings:

1. Edit `web/config.json`
2. Regenerate trace files: `python scripts/generate_traces.py`
3. Refresh the web dashboard

**Important:** After changing `matrixSize`, you must regenerate trace files, as the filename pattern will change.

## File Naming Convention

Trace files follow this pattern:

```
{precision}_cond{conditionNumber}_n{matrixSize}.json
```

Examples:

- `fp32_cond100_n50.json` - FP32, condition number 100, matrix size 50
- `fp16_cond1000_n50.json` - FP16, condition number 1000, matrix size 50

## Benefits

- **Single Source of Truth**: Configuration is defined once and used everywhere
- **Consistency**: Web frontend and Python scripts always use matching settings
- **Easy Updates**: Change matrix size or conditions in one place
- **Testability**: Tests can programmatically access the same configuration
