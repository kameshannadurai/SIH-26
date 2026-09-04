@echo off
title Build Legal Metrology Web Production Bundle
cd /d "%~dp0web"
echo ========================================================
echo   BUILDING PRODUCTION WEB BUNDLE
echo ========================================================
echo.

call npm run build

echo.
echo ========================================================
echo Web production bundle ready in web\dist!
echo ========================================================
pause
