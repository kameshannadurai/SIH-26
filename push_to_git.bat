@echo off
title Push ScaleSync Updates to GitHub
color 0A
cls
echo ==============================================================================
echo             PUSH SCALESYNC PLATFORM FIXES TO GITHUB REPOSITORY
echo ==============================================================================
echo.
echo [*] Staging all updated project files...
git add .
echo.
echo [*] Current Git Status:
git status -s
echo.
set /p commit_msg="Enter commit message [Default: 'fix: make production Docker deployment Render compatible']: "
if "%commit_msg%"=="" set commit_msg="fix: make production Docker deployment Render compatible"

echo.
echo [*] Committing changes...
git commit -m %commit_msg%

echo.
echo [*] Pushing commit to GitHub remote...
git push origin main

echo.
echo ==============================================================================
echo   Push completed successfully!
echo ==============================================================================
pause
