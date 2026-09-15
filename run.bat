@echo off
title Observatory PYQ - Fast Launch
cd /d "%~dp0"

echo ===================================================
echo     OBSERVATORY PYQ - FAST LAUNCHER
echo ===================================================
echo.

if exist "venv\Scripts\python.exe" (
    echo [1/2] Virtual environment detected: venv
    set PYTHON_EXE=venv\Scripts\python.exe
) else (
    echo [1/2] Virtual environment not found in venv, using system python...
    set PYTHON_EXE=python
)

echo [2/2] Launching Django Dev Server at http://127.0.0.1:8000 ...
echo.
echo Opening browser in 2 seconds...
start "" "http://127.0.0.1:8000/"

"%PYTHON_EXE%" manage.py runserver 127.0.0.1:8000
pause
