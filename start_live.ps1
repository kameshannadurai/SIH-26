# Legal Metrology Platform - Live PowerShell Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  LEGAL METROLOGY DIGITAL VERIFICATION PLATFORM (ScaleSync)" -ForegroundColor Green
Write-Host "  Starting Backend API and Web Frontend Servers..." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# 1. Start Backend in a separate PowerShell window
Write-Host "`n[1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; if (Test-Path '.\venv\Scripts\python.exe') { .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 } else { python -m venv venv; .\venv\Scripts\pip.exe install -r requirements.production.txt; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 }"

Start-Sleep -Seconds 3

# 2. Start Frontend in a separate PowerShell window
Write-Host "[2/3] Starting React Vite Frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\web'; if (-not (Test-Path '.\node_modules')) { npm install }; npm run dev"

Start-Sleep -Seconds 3

# 3. Launch default browser
Write-Host "[3/3] Opening browser at http://localhost:5173 ..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  ScaleSync Platform is LIVE!" -ForegroundColor Green
Write-Host "  - Web Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  - Backend API:   http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  - API Swagger:   http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Green
