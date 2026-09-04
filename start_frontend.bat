@echo off
title ScaleSync Frontend (Vite - Port 5173)
cd /d "%~dp0web"
echo ===================================================
echo   STARTING SCALESYNC REACT VITE ON PORT 5173
echo ===================================================
echo.

if exist "node_modules\.bin\vite.cmd" (
    echo [OK] Using local Vite binary...
    node_modules\.bin\vite.cmd --host 127.0.0.1 --port 5173
) else (
    echo [Info] Installing web packages...
    call npm install
    call npm run dev
)

echo.
echo [Warning] Frontend server stopped.
pause
