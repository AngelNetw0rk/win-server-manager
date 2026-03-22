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

:: Stop running processes
if exist "%PID_FILE%" (
    set /p "pid=" < "%PID_FILE%"
    echo  Stopping server (PID: !pid!)...
    taskkill /PID !pid! /T /F >nul 2>&1
    del "%PID_FILE%" >nul 2>&1
)
if exist "%TUNNEL_PID_FILE%" (
    set /p "tpid=" < "%TUNNEL_PID_FILE%"
    echo  Stopping tunnel (PID: !tpid!)...
    taskkill /PID !tpid! /T /F >nul 2>&1
    del "%TUNNEL_PID_FILE%" >nul 2>&1
)

echo  Removing node_modules...
if exist "%ROOT%node_modules" rd /s /q "%ROOT%node_modules"

echo  Removing package-lock.json...
if exist "%ROOT%package-lock.json" del /q "%ROOT%package-lock.json"

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

:: Stop running processes
if exist "%PID_FILE%" (
    set /p "pid=" < "%PID_FILE%"
    echo  Stopping server (PID: !pid!)...
    taskkill /PID !pid! /T /F >nul 2>&1
)
if exist "%TUNNEL_PID_FILE%" (
    set /p "tpid=" < "%TUNNEL_PID_FILE%"
    echo  Stopping tunnel (PID: !tpid!)...
    taskkill /PID !tpid! /T /F >nul 2>&1
)

echo  Removing node_modules...
if exist "%ROOT%node_modules" rd /s /q "%ROOT%node_modules"

echo  Removing package-lock.json...
if exist "%ROOT%package-lock.json" del /q "%ROOT%package-lock.json"

echo  Removing data directory (DB, logs, settings)...
if exist "%DATA_DIR%" rd /s /q "%DATA_DIR%"

echo.
echo  [OK] Full reset complete.
echo  Project restored to original state.
echo.
pause

:done
exit /b
