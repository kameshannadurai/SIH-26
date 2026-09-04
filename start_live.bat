@echo off
title ScaleSync Live Launcher
echo ========================================================
echo   LEGAL METROLOGY DIGITAL VERIFICATION PLATFORM
echo   Starting Backend (8000) and Frontend (5173)...
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Launching Backend Server...
start "" "%~dp0start_backend.bat"

timeout /t 3 /nobreak >nul

echo [2/3] Launching Frontend Server...
start "" "%~dp0start_frontend.bat"

timeout /t 3 /nobreak >nul

echo [3/3] Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ========================================================
echo   ScaleSync Platform is LIVE!
echo   - Web Frontend:  http://localhost:5173
echo   - Backend API:   http://127.0.0.1:8000
echo   - Swagger Docs:  http://127.0.0.1:8000/docs
echo ========================================================
echo Keep the backend and frontend terminal windows open.
pause
