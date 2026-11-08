param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("status", "start", "stop", "restart", "logs", "install-autostart", "uninstall-autostart")]
  [string]$Action
)

$RootDir = "d:\vyntric-support"
$LockPort = 39482
$StartupDir = [Environment]::GetFolderPath("Startup")
$StartupFile = Join-Path $StartupDir "VyntricBotStartup.vbs"
$SilentVbs = Join-Path $RootDir "scripts\start-bot-silent.vbs"
$StopFlag = Join-Path $RootDir ".bot-stop"
$LogFile = Join-Path $RootDir "logs\bot.log"

Set-Location -Path $RootDir

function Get-BotConnection {
  return Get-NetTCPConnection -LocalPort $LockPort -ErrorAction SilentlyContinue
}

switch ($Action) {
  "status" {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "          VYNTIC SUPPORT BOT - STATUS CHECK            " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    
    $conn = Get-BotConnection
    if ($conn) {
      $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($p in $pids) {
        $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
        if ($proc) {
          $memMb = [math]::Round($proc.WorkingSet64 / 1MB, 2)
          Write-Host " STATUS:      " -NoNewline
          Write-Host "[ ONLINE ]" -ForegroundColor Green -BackgroundColor Black
          Write-Host " Process:     $($proc.ProcessName) (PID: $($proc.Id))"
          Write-Host " Memory:      $memMb MB"
          Write-Host " Started:     $($proc.StartTime)"
          Write-Host " Lock Port:   $LockPort (Active)"
        }
      }
    } else {
      Write-Host " STATUS:      " -NoNewline
      Write-Host "[ OFFLINE ]" -ForegroundColor Red -BackgroundColor Black
      Write-Host " The bot is not currently running."
    }

    $isAutoStart = Test-Path $StartupFile
    Write-Host " Auto-Start:  $(if ($isAutoStart) { '[ ENABLED ] (Starts on PC boot)' } else { '[ DISABLED ]' })" `
      -ForegroundColor $(if ($isAutoStart) { "Green" } else { "DarkGray" })

    Write-Host "========================================================" -ForegroundColor Cyan
  }

  "start" {
    Write-Host "Starting Vyntric Support Bot..." -ForegroundColor Cyan
    $conn = Get-BotConnection
    if ($conn) {
      Write-Host "The bot is ALREADY running!" -ForegroundColor Yellow
      & $PSCommandPath -Action status
      return
    }

    if (Test-Path $StopFlag) {
      Remove-Item -Path $StopFlag -Force -ErrorAction SilentlyContinue
    }

    cmd.exe /c start "" wscript.exe "$SilentVbs"
    Write-Host "Launched in background. Waiting for bot to initialize..." -ForegroundColor Gray

    $online = $false
    for ($i = 0; $i -lt 15; $i++) {
      Start-Sleep -Seconds 1
      if (Get-BotConnection) {
        $online = $true
        break
      }
    }

    if ($online) {
      Write-Host "Bot successfully connected and online!" -ForegroundColor Green
    } else {
      Write-Host "Bot launched. (Still connecting to Discord gateway...)" -ForegroundColor Yellow
    }

    & $PSCommandPath -Action status
  }

  "stop" {
    Write-Host "Stopping Vyntric Support Bot..." -ForegroundColor Cyan
    New-Item -Path $StopFlag -ItemType File -Force | Out-Null

    $conn = Get-BotConnection
    if ($conn) {
      $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pidToKill in $pids) {
        Write-Host "Terminating bot process (PID: $pidToKill)..." -ForegroundColor Yellow
        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
      }
    }

    # Also stop any runner cmd.exe
    $procs = Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -like "*run-bot.bat*" }
    foreach ($p in $procs) {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Start-Sleep -Seconds 1
    $stillRunning = Get-BotConnection
    if ($stillRunning) {
      Write-Host "Warning: Process may still be closing." -ForegroundColor Yellow
    } else {
      Write-Host "Bot stopped successfully." -ForegroundColor Green
    }
  }

  "restart" {
    Write-Host "Restarting Vyntric Support Bot..." -ForegroundColor Cyan
    & $PSCommandPath -Action stop
    Start-Sleep -Seconds 2
    & $PSCommandPath -Action start
  }

  "logs" {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "          VYNTIC SUPPORT BOT - LIVE LOGS               " -ForegroundColor Cyan
    Write-Host "          (Press Ctrl+C to exit log view)              " -ForegroundColor DarkGray
    Write-Host "========================================================" -ForegroundColor Cyan
    if (-not (Test-Path $LogFile)) {
      Write-Host "No log file found at $LogFile" -ForegroundColor Yellow
      return
    }
    Get-Content -Path $LogFile -Tail 40 -Wait
  }

  "install-autostart" {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "     INSTALLING VYNTIC BOT WINDOWS AUTO-START           " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    if (-not (Test-Path $StartupDir)) {
      Write-Host "Error: Startup directory not found: $StartupDir" -ForegroundColor Red
      return
    }

    Copy-Item -Path $SilentVbs -Destination $StartupFile -Force
    if (Test-Path $StartupFile) {
      Write-Host "SUCCESS: Auto-start configured successfully!" -ForegroundColor Green
      Write-Host "Location: $StartupFile"
      Write-Host ""
      Write-Host " How it works:" -ForegroundColor Cyan
      Write-Host "  1. PC ON:  Bot starts automatically in the background."
      Write-Host "  2. PC OFF: Bot turns off automatically."
      Write-Host "  3. Crash:  Bot restarts automatically if it ever closes."
    } else {
      Write-Host "Error: Failed to copy startup file." -ForegroundColor Red
    }
    Write-Host "========================================================" -ForegroundColor Cyan
  }

  "uninstall-autostart" {
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "     UNINSTALLING VYNTIC BOT WINDOWS AUTO-START         " -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan

    if (Test-Path $StartupFile) {
      Remove-Item -Path $StartupFile -Force
      Write-Host "SUCCESS: Auto-start has been removed." -ForegroundColor Green
      Write-Host "The bot will NO LONGER start automatically on PC boot."
    } else {
      Write-Host "Auto-start is not currently installed." -ForegroundColor Yellow
    }
    Write-Host "========================================================" -ForegroundColor Cyan
  }
}
