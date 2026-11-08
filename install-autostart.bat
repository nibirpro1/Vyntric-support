@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bot-control.ps1" -Action install-autostart
echo.
pause
