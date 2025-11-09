#!/bin/bash
set -e

echo "🚀 Setting up PrecisionLens development environment..."

# Install Python dependencies
echo "📦 Installing Python dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

# Install and configure pre-commit
echo "🪝 Installing pre-commit hooks..."
pre-commit install --install-hooks

# Install Node.js dependencies for web
echo "📦 Installing Node.js dependencies..."
cd web
npm install
cd ..

# Verify installations
echo ""
echo "✅ Environment setup complete!"
echo ""
echo "Installed versions:"
echo "  Python: $(python --version)"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo ""
echo "Pre-commit hooks installed. They will run automatically on git commit."
echo ""
echo "Available commands:"
echo "  Python linting:"
echo "    - black --check ."
echo "    - isort --check-only --profile black ."
echo "    - flake8 ."
echo "    - mypy . --ignore-missing-imports"
echo ""
echo "  JavaScript linting (from web/):"
echo "    - npm run lint"
echo "    - npm run format:check"
echo ""
echo "  Testing:"
echo "    - pytest tests/ -v --cov"
echo "    - cd web && npm test"
echo ""
echo "  Pre-commit:"
echo "    - pre-commit run --all-files"
