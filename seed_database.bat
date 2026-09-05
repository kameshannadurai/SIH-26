@echo off
title ScaleSync - Populate Master Demo Database
cd /d "%~dp0backend"
echo ========================================================
echo   LEGAL METROLOGY MASTER DEMO DATABASE POPULATOR
echo   Populating Tamil Nadu Districts, GATC, LMO & Data...
echo ========================================================
echo.


if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe scripts\seed_demo_ecosystem.py
) else (
    python scripts\seed_demo_ecosystem.py
)

echo.
echo ========================================================
echo Master demo data populated successfully!
echo ========================================================
pause