#!/usr/bin/env bash
# ==============================================================================
# Orchids KIIT ExamPrep AI & Mock Portal - Production Build Script
# Designed for Render Web Service (Native Python Runtime)
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "======================================================================"
echo ">>> [Step 1/4] Preparing React Frontend Assets..."
echo "======================================================================"

if command -v npm >/dev/null 2>&1; then
    echo "Found Node.js & npm. Compiling React frontend with Vite..."
    cd frontend
    # Use npm ci for clean, reproducible builds if lockfile is present, else npm install
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    npm run build
    cd ..
    echo "Frontend build completed successfully into frontend/dist/."
elif [ -d "frontend/dist" ] && [ -f "frontend/dist/index.html" ]; then
    echo "npm not detected in PATH, but pre-compiled frontend/dist detected."
    echo "Proceeding with existing frontend assets."
else
    echo "ERROR: npm is not available in this build environment, and no pre-built"
    echo "frontend/dist/index.html was found."
    echo ""
    echo "To resolve this on Render:"
    echo "  Option A: Use Render's native Node build or Docker runtime."
    echo "  Option B: Build the frontend locally ('cd frontend && npm run build') and"
    echo "            commit frontend/dist/ to your Git repository."
    exit 1
fi

echo "======================================================================"
echo ">>> [Step 2/4] Installing Python Backend Dependencies..."
echo "======================================================================"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "======================================================================"
echo ">>> [Step 3/4] Collecting Django Static Files via WhiteNoise..."
echo "======================================================================"
python manage.py collectstatic --noinput

echo "======================================================================"
echo ">>> [Step 4/4] Applying Database Migrations..."
echo "======================================================================"
# Applies any unapplied migrations (safe to run on SQLite seed database)
python manage.py migrate --noinput

echo "======================================================================"
echo ">>> Build completed successfully! Ready for server launch."
echo "======================================================================"
