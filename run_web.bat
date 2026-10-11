@echo off
title Neon Air Studio - Web Launcher
cd /d "%~dp0\.."
echo ========================================================
echo   NEON AIR STUDIO - AI Vision Web Air Painter
echo ========================================================
echo Launching Neon Air Studio in your browser...
start "" "http://localhost:3000/air_painting/index.html"
node server.js
pause
