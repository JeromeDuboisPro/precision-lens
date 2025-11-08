"""
Web Configuration Utility

Provides a Python interface to read web/config.json for consistent
configuration between web frontend and Python scripts/tests.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any


def get_project_root() -> Path:
    """
    Get the project root directory.

    Returns:
        Path to project root
    """
    # Assume this file is in web/ directory
    return Path(__file__).parent.parent


def load_config(config_path: str = None) -> Dict[str, Any]:
    """
    Load web configuration from config.json.

    Args:
        config_path: Optional path to config.json. If None, uses web/config.json

    Returns:
        Configuration dictionary with keys:
        - matrixSize: int
        - conditionNumbers: List[int]
        - precisions: List[str]
        - tracesDirectory: str
    """
    if config_path is None:
        config_path = get_project_root() / 'web' / 'config.json'
    else:
        config_path = Path(config_path)

    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Configuration file not found: {config_path}\n"
            "Please ensure web/config.json exists in the project root."
        )
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in configuration file: {e}")


def get_trace_filename(precision: str, condition_number: int, matrix_size: int = None) -> str:
    """
    Generate trace filename following the project naming convention.

    Args:
        precision: Precision type (fp64, fp32, fp16, fp8)
        condition_number: Matrix condition number
        matrix_size: Matrix size. If None, loads from config.json

    Returns:
        Trace filename string
    """
    if matrix_size is None:
        config = load_config()
        matrix_size = config['matrixSize']

    return f"{precision}_cond{condition_number}_n{matrix_size}.json"


def get_web_traces_dir() -> Path:
    """
    Get the full path to the web traces directory.

    Returns:
        Path to web traces directory
    """
    config = load_config()
    return get_project_root() / 'web' / config['tracesDirectory']


if __name__ == '__main__':
    # Quick test/demo
    config = load_config()
    print("Web Configuration:")
    print(f"  Matrix Size: {config['matrixSize']}")
    print(f"  Condition Numbers: {config['conditionNumbers']}")
    print(f"  Precisions: {config['precisions']}")
    print(f"  Traces Directory: {config['tracesDirectory']}")
    print(f"\nExample trace filename: {get_trace_filename('fp32', 100)}")
    print(f"Web traces directory: {get_web_traces_dir()}")
