# Development Container

This devcontainer provides a consistent development environment that **exactly matches** the CI/CD pipeline.

## What's Included

### Environment
- **Python 3.12** (matches CI/CD)
- **Node.js 20** (matches CI/CD)
- **Git** pre-configured

### Python Tools (Auto-installed)
- black (formatter)
- isort (import sorter)
- flake8 (linter)
- mypy (type checker)
- pytest (testing)
- pre-commit (git hooks)

### JavaScript Tools (Auto-installed)
- ESLint (linter)
- Prettier (formatter)
- Jest (testing)

### VSCode Extensions (Auto-installed)
- Python (with Black, isort, mypy, flake8)
- ESLint
- Prettier

## Usage

### Opening in Claude Code
1. Open the repository
2. Claude Code will detect the devcontainer
3. Click "Reopen in Container" when prompted
4. Wait for setup to complete (~2-3 minutes first time)

### Opening in VSCode/Codespaces
1. Install "Dev Containers" extension
2. Command Palette → "Dev Containers: Reopen in Container"
3. Wait for setup to complete

### Opening Locally with Docker
1. Install Docker Desktop
2. Install VSCode "Dev Containers" extension
3. Open folder in VSCode
4. Click "Reopen in Container"

## Features

### Automatic Setup
On container creation, the setup script automatically:
1. Installs all Python dependencies from `requirements.txt`
2. Installs all Node.js dependencies from `web/package.json`
3. Installs and configures pre-commit hooks
4. Verifies all installations

### Pre-commit Hooks
Pre-commit hooks run **automatically** on every commit, checking:
- Python: black, isort, flake8, mypy
- JavaScript: ESLint, Prettier
- Files: trailing whitespace, EOF, YAML/JSON validity

To run manually:
```bash
pre-commit run --all-files
```

### Format on Save
VSCode is configured to:
- Auto-format Python files with black on save
- Auto-sort Python imports on save
- Auto-format JavaScript files with Prettier on save
- Trim trailing whitespace
- Ensure final newline

### Testing
```bash
# Python tests
pytest tests/ -v --cov

# JavaScript tests
cd web && npm test
```

## CI/CD Parity

The devcontainer **guarantees** that your local environment matches CI/CD:

| Component | Local (Devcontainer) | CI/CD |
|-----------|---------------------|-------|
| Python    | 3.12                | 3.12  |
| Node.js   | 20                  | 20    |
| black     | ✅                  | ✅    |
| isort     | ✅                  | ✅    |
| flake8    | ✅                  | ✅    |
| mypy      | ✅                  | ✅    |
| ESLint    | ✅                  | ✅    |
| Prettier  | ✅                  | ✅    |
| pytest    | ✅                  | ✅    |
| Jest      | ✅                  | ✅    |

**If it passes locally, it will pass in CI/CD.**

## Troubleshooting

### Pre-commit hooks not running
```bash
pre-commit install
```

### Dependencies not installed
```bash
pip install -r requirements.txt
cd web && npm install
```

### Rebuild container
Command Palette → "Dev Containers: Rebuild Container"
