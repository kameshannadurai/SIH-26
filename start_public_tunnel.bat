@echo off
title Legal Metrology Platform - Instant Public Internet Hosting
color 0A
cls
echo ==============================================================================
echo       LEGAL METROLOGY DIGITAL PLATFORM - INSTANT PUBLIC HOSTING
echo ==============================================================================
echo.
echo  This tool creates a secure public HTTPS URL for your application.
echo  Anyone on any phone, tablet, or PC worldwide can access the live platform.
echo.
echo  [1] Cloudflare Quick Tunnel (RECOMMENDED - Free, HTTPS, No Sign-up/Password)
echo  [2] Localtunnel (HTTPS public URL via localtunnel.me)
echo  [3] Show Local Network Wi-Fi URL (For devices on your same Wi-Fi)
echo.
echo ==============================================================================
set /p choice="Select an option (1, 2, or 3) [Default 1]: "

if "%choice%"=="" set choice=1
if "%choice%"=="1" goto CLOUDFLARE
if "%choice%"=="2" goto LOCALTUNNEL
if "%choice%"=="3" goto LOCAL_WIFI

:CLOUDFLARE
echo.
echo [*] Starting Cloudflare Quick Tunnel on port 5173...
echo [*] Vite reverse-proxy handles both Frontend (React) and Backend (FastAPI API)...
echo.
echo ------------------------------------------------------------------------------
echo Look for the public link ending with .trycloudflare.com below:
echo ------------------------------------------------------------------------------
echo.
npx --yes untun tunnel http://127.0.0.1:5173
pause
exit

:LOCALTUNNEL
echo.
echo [*] Starting Localtunnel on port 5173...
echo [*] If prompted for an IP password, enter your public IP (visit https://loca.lt/mytunnelpassword)
echo.
npx --yes localtunnel --port 5173
pause
exit

:LOCAL_WIFI
cls
echo ==============================================================================
echo                LOCAL NETWORK / MOBILE WI-FI ACCESS
echo ==============================================================================
echo.
echo  Connect your phone to the same Wi-Fi network and open:
echo.
echo       >>> http://10.207.128.74:5173 <<<
echo.
echo  Features available on mobile:
echo   - Citizen QR Scan & Complaint Filing
echo   - GPS Geofence Check
echo   - Full Business Application & Verification Workflow
echo   - LMO / GATC Dashboard
echo.
echo ==============================================================================
pause
exit
