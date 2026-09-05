@echo off
title Build Legal Metrology Android APK
cd /d "%~dp0mobile"
echo ========================================================
echo   BUILDING FLUTTER ANDROID APK (RELEASE)
echo ========================================================

set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=C:\Program Files\Android\Android Studio\jbr\bin;%PATH%"

call flutter build apk --release

echo.
echo ========================================================
echo APK Output Location:
echo mobile\build\app\outputs\flutter-apk\app-release.apk
echo ========================================================
pause
