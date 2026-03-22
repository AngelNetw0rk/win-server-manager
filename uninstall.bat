@echo off
setlocal EnableDelayedExpansion
title Win Server Manager - Uninstall

set "ROOT=%~dp0"
set "DATA_DIR=%ROOT%data"
set "PID_FILE=%DATA_DIR%\server.pid"
set "TUNNEL_PID_FILE=%DATA_DIR%\tunnel.pid"

cls
echo.
echo  ============================================
echo       Win Server Manager - Uninstall
echo  ============================================
echo.
echo  This will remove all installed dependencies
echo  and restore the project to its original state.
echo.
echo  [1] Soft reset (remove node_modules only, keep DB)
echo  [2] Full reset (remove node_modules + data/DB)
echo  [0] Cancel
echo.
set /p "choice=  Select: "

if "%choice%"=="0" goto done
if "%choice%"=="1" goto soft_reset
if "%choice%"=="2" goto full_reset
goto done

:soft_reset
echo.

:: --- Stop running processes ---
call :kill_all_processes

call :log " Removing node_modules..."
if exist "%ROOT%node_modules" rd /s /q "%ROOT%node_modules"

call :log " Removing package-lock.json..."
if exist "%ROOT%package-lock.json" del /q "%ROOT%package-lock.json"

:: --- Clean stale files in data/ (logs, tunnel state) ---
call :log " Cleaning stale logs and temp files..."
if exist "%DATA_DIR%\server.log" del /q "%DATA_DIR%\server.log"
if exist "%DATA_DIR%\tunnel.log" del /q "%DATA_DIR%\tunnel.log"
if exist "%DATA_DIR%\tunnel_mode.txt" del /q "%DATA_DIR%\tunnel_mode.txt"
if exist "%DATA_DIR%\tunnel_name.txt" del /q "%DATA_DIR%\tunnel_name.txt"
if exist "%DATA_DIR%\tunnel_url.txt" del /q "%DATA_DIR%\tunnel_url.txt"

echo.
echo  [OK] Soft reset complete.
echo  Database and settings preserved in data/
echo.
pause
goto done

:full_reset
echo.
set /p "confirm=  Delete ALL data including DB? [y/N]: "
if /i not "!confirm!"=="y" (
    echo  Cancelled.
    pause
    goto done
)

:: --- Stop running processes ---
call :kill_all_processes

call :log " Removing node_modules..."
if exist "%ROOT%node_modules" rd /s /q "%ROOT%node_modules"

call :log " Removing package-lock.json..."
if exist "%ROOT%package-lock.json" del /q "%ROOT%package-lock.json"

call :log " Removing data directory (DB, logs, settings)..."
if exist "%DATA_DIR%" rd /s /q "%DATA_DIR%"

echo.
echo  [OK] Full reset complete.
echo  Project restored to original state.
echo.
pause
goto done

:: ==================== SUBROUTINE: Kill all processes ====================
:kill_all_processes
:: 1. Try PID-based kill (server)
if exist "%PID_FILE%" (
    set /p "pid=" < "%PID_FILE%"
    call :log " Stopping server (PID: !pid!)..."
    taskkill /PID !pid! /T /F >nul 2>&1
    del "%PID_FILE%" >nul 2>&1
)
:: 2. Try PID-based kill (tunnel)
if exist "%TUNNEL_PID_FILE%" (
    set /p "tpid=" < "%TUNNEL_PID_FILE%"
    call :log " Stopping tunnel (PID: !tpid!)..."
    taskkill /PID !tpid! /T /F >nul 2>&1
    del "%TUNNEL_PID_FILE%" >nul 2>&1
)
:: 3. Fallback: kill by image name to catch any orphan processes
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find "node.exe" >nul
if not errorlevel 1 (
    call :log " Killing orphan node.exe processes..."
    taskkill /IM node.exe /T /F >nul 2>&1
)
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find "cloudflared.exe" >nul
if not errorlevel 1 (
    call :log " Killing orphan cloudflared.exe processes..."
    taskkill /IM cloudflared.exe /T /F >nul 2>&1
)

:: Kill pty agents if stuck
taskkill /IM winpty-agent.exe /T /F >nul 2>&1
taskkill /IM conhost.exe /FI "WINDOWTITLE eq xterm-256color" /T /F >nul 2>&1

:: 4. Verify cleanup
call :log " Waiting for processes to exit gracefully..."
timeout /t 3 /nobreak >nul
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find "node.exe" >nul
if not errorlevel 1 (
    call :log "  [WARN] Some node.exe processes may still be running."
) else (
    call :log "  [OK] All processes stopped."
)
goto :eof

:log
set "msg=%~1"
if "!msg!"=="" (
    echo.
    echo. >> "%ROOT%uninstall.log"
) else (
    echo !msg!
    echo !msg! >> "%ROOT%uninstall.log"
)
goto :eof

:done
exit /b
