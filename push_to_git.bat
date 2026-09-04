@echo off
title Push Legal Metrology Platform to Git
color 0A
cls
echo ==============================================================================
echo             PUSH LEGAL METROLOGY PLATFORM TO GIT REPOSITORY
echo ==============================================================================
echo.
echo [*] Adding all project files...
git add .

echo.
echo [*] Staging status:
git status -s

echo.
set /p commit_msg="Enter commit message [Default: 'feat: Complete smart e-metrology ecosystem upgrade with public hosting']: "

if "%commit_msg%"=="" set commit_msg="feat: Complete smart e-metrology ecosystem upgrade with public hosting"

echo.
echo [*] Committing changes...
git commit -m %commit_msg%

echo.
echo [*] Pushing to remote repository...
git push

echo.
echo ==============================================================================
echo   Push process completed!
echo ==============================================================================
pause
