@echo off
title ScaleSync Backend (FastAPI - Port 8000)
cd /d "%~dp0backend"
echo ===================================================
echo   STARTING SCALESYNC FASTAPI BACKEND ON PORT 8000
echo ===================================================
echo.

if exist "venv\Scripts\python.exe" (
    echo [OK] Using Python virtual environment...
    venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) else if exist "venv\Scripts\uvicorn.exe" (
    echo [OK] Using Uvicorn executable...
    venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8000
) else (
    echo [Info] Virtual environment not found, creating one...
    python -m venv venv
    venv\Scripts\pip.exe install -r requirements.txt
    venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
)

echo.
echo [Warning] Backend server stopped.
pause
