@echo off
setlocal
cd /d "d:\vyntric-support"

if not exist "logs" mkdir "logs"

:: Remove stop flag if present
if exist ".bot-stop" del ".bot-stop"

echo ======================================================== >> "logs\bot.log"
echo [STARTUP] Plugsy Vyntric Bot Runner started at %date% %time% >> "logs\bot.log"
echo ======================================================== >> "logs\bot.log"

:loop
if exist ".bot-stop" (
    echo [%date% %time%] [INFO] Stop flag detected. Exiting runner loop. >> "logs\bot.log"
    goto end
)

:: Check if another instance is already listening on port 39482
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 39482 -ErrorAction SilentlyContinue) { exit 42 } else { exit 0 }"
if %ERRORLEVEL% EQU 42 (
    echo [%date% %time%] [INFO] Bot is already running on port 39482. Exiting duplicate runner. >> "logs\bot.log"
    goto end
)

echo [%date% %time%] [INFO] Launching Plugsy... >> "logs\bot.log"
"C:\Program Files\nodejs\node.exe" dist\index.js >> "logs\bot.log" 2>&1

:: If .bot-stop was created while node was running, exit cleanly without restarting
if exist ".bot-stop" (
    echo [%date% %time%] [INFO] Bot stopped cleanly by user. >> "logs\bot.log"
    goto end
)

echo [%date% %time%] [WARN] Bot process exited unexpectedly. Restarting in 5 seconds... >> "logs\bot.log"
timeout /t 5 /nobreak >nul
goto loop

:end
endlocal
