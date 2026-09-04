@echo off
title Build Legal Metrology Android APK
cd /d "%~dp0mobile"
echo ========================================================
echo   BUILDING FLUTTER ANDROID APK (RELEASE)
echo ========================================================
echo.

call flutter build apk --release

echo.
echo ========================================================
echo APK Output Location:
echo mobile\build\app\outputs\flutter-apk\app-release.apk
echo ========================================================
pause
