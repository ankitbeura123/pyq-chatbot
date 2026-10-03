@echo off
title Orchids PYQ - Fast Launch
cd /d "%~dp0"

echo ===================================================
echo        ORCHIDS PYQ - FAST LAUNCHER
echo ===================================================
echo.

if exist "venv\Scripts\python.exe" (
    echo [1/3] Virtual environment detected: venv
    set PYTHON_EXE=venv\Scripts\python.exe
) else (
    echo [1/3] Virtual environment not found in venv, using system python...
    set PYTHON_EXE=python
)

echo [2/3] Building frontend (npm run build)...
pushd frontend
call npm run build
popd
echo.

echo [3/3] Launching Django Dev Server at http://127.0.0.1:8000 ...
echo.
echo Opening browser in 2 seconds...
start "" "http://127.0.0.1:8000/"

"%PYTHON_EXE%" manage.py runserver 127.0.0.1:8000
pause