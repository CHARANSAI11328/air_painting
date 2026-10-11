@echo off
title Neon Air Studio - Python OpenCV Launcher
cd /d "%~dp0"
echo ========================================================
echo   NEON AIR STUDIO - Python OpenCV Air Painter
echo ========================================================
set VENV_PY=..\harry_potter_cloak\.venv\Scripts\python.exe

if exist "%VENV_PY%" (
    echo [OK] Using pre-configured Python environment...
    "%VENV_PY%" air_painter.py
) else (
    echo [INFO] Searching for system Python...
    py air_painter.py
)
pause
