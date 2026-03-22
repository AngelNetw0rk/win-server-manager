@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Win Server Manager

set "ROOT=%~dp0"
set "DATA_DIR=%ROOT%data"
set "DB_FILE=%DATA_DIR%\manager.db"
set "PID_FILE=%DATA_DIR%\server.pid"
set "TUNNEL_PID_FILE=%DATA_DIR%\tunnel.pid"

if exist "%DATA_DIR%\lang.txt" (
    set /p "LANG=" < "%DATA_DIR%\lang.txt"
) else (
    set "LANG=EN"
)

:menu
cls
echo.
echo  ============================================
echo       Win Server Manager v1.0
echo  ============================================
echo.
if "!LANG!"=="RU" (
    echo   [1] Установка
    echo   [2] Обновление
    echo   [3] Запуск сервера
    echo   [4] Остановка сервера
    echo   [5] Статус
    echo   [6] Настройка Cloudflare Tunnel
    echo   [7] Запуск туннеля
    echo   [8] Остановка туннеля
    echo   [0] Выход
) else (
    echo   [1] Install
    echo   [2] Update
    echo   [3] Start Server
    echo   [4] Stop Server
    echo   [5] Status
    echo   [6] Setup Cloudflare Tunnel
    echo   [7] Start Tunnel
    echo   [8] Stop Tunnel
    echo   [0] Exit
)
echo.
echo  ============================================
echo.
set /p "choice=  Select: "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto update
if "%choice%"=="3" goto start_server
if "%choice%"=="4" goto stop_server
if "%choice%"=="5" goto status
if "%choice%"=="6" goto setup_tunnel
if "%choice%"=="7" goto start_tunnel
if "%choice%"=="8" goto stop_tunnel
if "%choice%"=="0" exit /b
goto menu

:: ==================== INSTALL ====================
:install
cls
echo.
echo  [Install] Checking prerequisites...
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found.
    echo  Download: https://nodejs.org/
    pause
    goto menu
)
for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"
echo  [OK] Node.js %NODE_VER%

where npm >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] npm not found.
    pause
    goto menu
)
for /f "tokens=*" %%i in ('npm -v') do set "NPM_VER=%%i"
echo  [OK] npm v%NPM_VER%

if not exist "%DATA_DIR%" (
    mkdir "%DATA_DIR%"
    echo  [OK] Created data directory
)

echo.
echo  Installing dependencies...
echo.
cd /d "%ROOT%"
call npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed.
    echo  If node-pty fails, run:
    echo  npm install --global windows-build-tools
    pause
    goto menu
)
echo.
echo  [OK] Dependencies installed.

echo.
echo  -- Create Admin Account --
echo.
set /p "admin_user=  Username: "
set /p "admin_pass=  Password: "

if "%admin_user%"=="" (
    echo  [ERROR] Username cannot be empty.
    pause
    goto menu
)
if "%admin_pass%"=="" (
    echo  [ERROR] Password cannot be empty.
    pause
    goto menu
)

node -e "const db=require('./modules/database');db.init();const auth=require('./modules/auth');try{auth.createUser('%admin_user%','%admin_pass%');console.log('  [OK] Admin created: %admin_user%')}catch(e){console.log('  [WARN] '+e.message)}"

echo.
echo  ============================================
echo   Installation complete!
echo   Start server with option [3].
echo   For external access use option [6].
echo  ============================================
echo.
pause
goto menu

:: ==================== UPDATE ====================
:update
cls
echo.
echo  ============================================
if "!LANG!"=="RU" (
    echo   [Обновление] Win Server Manager
) else (
    echo   [Update] Win Server Manager
)
echo  ============================================
echo.

if not exist "%ROOT%server.js" (
    if "!LANG!"=="RU" (
        echo  [ERROR] Софт не установлен. Сначала выполните Установку [1].
    ) else (
        echo  [ERROR] Software is not installed. Run Install first.
    )
    pause
    goto menu
)

:: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
:: Укажи здесь свой репозиторий: "username/repo"
set "REPO=AngelNetw0rk/win-server-manager"
set "BRANCH=main"
:: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

set "CUR_VER=0.0.0"
if exist "%ROOT%VERSION" set /p "CUR_VER=" < "%ROOT%VERSION"

echo  Current Version:  !CUR_VER!
echo  Checking GitHub for "!REPO!"...

:: 1. Проверка новой версии
for /f "delims=" %%v in ('powershell -noprofile -command "(Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/%REPO%/%BRANCH%/VERSION' -ErrorAction SilentlyContinue).Trim()"') do set "REMOTE_VER=%%v"

if "!REMOTE_VER!"=="" (
    echo  [ERROR] Cannot fetch remote version.
    echo  Make sure the REPO variable is correct in manager.bat!
    pause
    goto menu
)

echo  Latest Version:   !REMOTE_VER!

if "!CUR_VER!"=="!REMOTE_VER!" goto update_same_ver

    echo.
    set /p "do_update=  Update to !REMOTE_VER!? (Y/n): "
    if /i "!do_update!"=="n" goto menu
    goto do_update_start

:update_same_ver
    echo.
    if "!LANG!"=="RU" (
        echo  Вы уже на последней версии.
        echo   [1] Форсировать обновление
        echo   [2] Ожидать новую версию ^(Авто-обновление^)
        echo   [0] Назад
    ) else (
        echo  You are already on the latest version.
        echo   [1] Force update anyway
        echo   [2] Wait for new version ^(Auto-update^)
        echo   [0] Back
    )
    echo.
    set /p "u_choice=  Select: "
    if "!u_choice!"=="0" goto menu
    if "!u_choice!"=="1" goto do_update_start
    if "!u_choice!"=="2" goto auto_updater
    goto update_same_ver

:auto_updater
    if "!LANG!"=="RU" (
        echo  [INFO] Режим ожидания... Проверка каждые 10 сек. Нажмите Ctrl+C для выхода.
    ) else (
        echo  [INFO] Watch mode... Checking every 10 sec. Press Ctrl+C to cancel.
    )

:auto_updater_loop
    timeout /t 10 /nobreak >nul
    for /f "delims=" %%v in ('powershell -noprofile -command "(Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/%REPO%/%BRANCH%/VERSION' -ErrorAction SilentlyContinue).Trim()"') do set "NEW_VER=%%v"
    if not "!NEW_VER!"=="" (
        if not "!NEW_VER!"=="!CUR_VER!" (
            set "REMOTE_VER=!NEW_VER!"
            echo.
            if "!LANG!"=="RU" (
                powershell -noprofile -command "Write-Host '  [OK] Найдена новая версия: !REMOTE_VER!' -ForegroundColor Green"
            ) else (
                powershell -noprofile -command "Write-Host '  [OK] New version found: !REMOTE_VER!' -ForegroundColor Green"
            )
            goto do_update_start
        )
    )
    goto auto_updater_loop

:do_update_start

echo.
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%DATA_DIR%\backups" mkdir "%DATA_DIR%\backups"

:: 2. BACKUP DATA
echo  [1/3] Creating Backup...
set "TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "BACKUP_DIR=%DATA_DIR%\backups\backup_%TIMESTAMP%"

mkdir "%BACKUP_DIR%"
if exist "%DB_FILE%" copy /y "%DB_FILE%" "%BACKUP_DIR%\manager.db" >nul
if exist "%DATA_DIR%\*.log" copy /y "%DATA_DIR%\*.log" "%BACKUP_DIR%\" >nul
if exist "%ROOT%VERSION" copy /y "%ROOT%VERSION" "%BACKUP_DIR%" >nul

echo  [OK] Data backed up to: data/backups/backup_%TIMESTAMP%
echo.

:: 3. DOWNLOAD & EXTRACT
echo  [2/3] Downloading updates from GitHub...
powershell -noprofile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $zip = Join-Path $env:TEMP 'wsm_upd.zip'; $ext = Join-Path $env:TEMP 'wsm_ext'; Invoke-WebRequest -Uri 'https://github.com/%REPO%/archive/refs/heads/%BRANCH%.zip' -OutFile $zip; if(Test-Path $ext){Remove-Item $ext -Recurse -Force}; Expand-Archive -Path $zip -DestinationPath $ext -Force; $src = Get-ChildItem $ext | Select-Object -First 1; $srcPath = Join-Path $src.FullName '*'; Copy-Item -Path $srcPath -Destination '%ROOT%' -Recurse -Force; Remove-Item $zip -Force; Remove-Item $ext -Recurse -Force; Write-Host '  [OK] Downloaded and extracted.' } catch { Write-Host \"  [ERROR] Download failed. $_\" -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
    pause
    goto menu
)
echo.

:: 4. REINSTALL DEPENDENCIES
echo  [3/3] Reinstalling dependencies...
cd /d "%ROOT%"
call npm install
if errorlevel 1 (
    echo  [ERROR] npm install failed.
    pause
    goto menu
)

if exist "%ROOT%modules\migrate.js" (
    echo  Running database migrations...
    node modules\migrate.js
)

echo.
echo  ============================================
echo  [OK] Update Complete!
if exist "%ROOT%VERSION" (
    set /p "NEW_VER=" < "%ROOT%VERSION"
    echo  Version is now: !NEW_VER!
)
if not "!CHANGELOG!"=="" (
    if "!LANG!"=="RU" (
        powershell -noprofile -command "Write-Host \"  Что добавлено: !CHANGELOG!\" -ForegroundColor Green"
    ) else (
        powershell -noprofile -command "Write-Host \"  What's new: !CHANGELOG!\" -ForegroundColor Green"
    )
)
echo  Your data and settings were preserved.
echo  ============================================
echo.
pause
goto menu

:: ==================== START SERVER ====================
:start_server
cls
echo.

if exist "%PID_FILE%" (
    set /p "old_pid=" < "%PID_FILE%"
    tasklist /FI "PID eq !old_pid!" 2>nul | find "node" >nul
    if not errorlevel 1 (
        echo  [WARN] Server already running (PID: !old_pid!)
        pause
        goto menu
    )
    :: Stale PID file, remove it
    del "%PID_FILE%" >nul 2>&1
)

if not exist "%ROOT%node_modules" (
    echo  [ERROR] Not installed. Run Install first.
    pause
    goto menu
)

echo  Starting server...
cd /d "%ROOT%"

:: Clear old PID file so we can detect new one
if exist "%PID_FILE%" del "%PID_FILE%" >nul 2>&1

start "" /b cmd /c "node server.js > "%DATA_DIR%\server.log" 2>&1"

:: Wait for server to write its own PID file (up to 10 seconds)
echo  Waiting for server to start...
set "WAIT_COUNT=0"
:wait_pid
if exist "%PID_FILE%" goto pid_found
timeout /t 1 /nobreak >nul
set /a "WAIT_COUNT+=1"
if !WAIT_COUNT! GEQ 10 goto pid_fail
goto wait_pid

:pid_found
set /p "SERVER_PID=" < "%PID_FILE%"
echo  [OK] Server started (PID: !SERVER_PID!)
echo  [OK] Local: http://localhost:3000
echo.
echo  For external access use option [7] (Start Tunnel)
echo.
pause
goto menu

:pid_fail
echo  [ERROR] Server did not start in 10 seconds.
echo  Check log: %DATA_DIR%\server.log
echo.
pause
goto menu

:: ==================== STOP SERVER ====================
:stop_server
cls
echo.
call :do_stop
pause
goto menu

:do_stop
if not exist "%PID_FILE%" (
    echo  [INFO] Server not running.
    goto :eof
)
set /p "pid=" < "%PID_FILE%"
echo  Stopping server (PID: %pid%)...
taskkill /PID %pid% /T /F >nul 2>&1
del "%PID_FILE%" >nul 2>&1
echo  [OK] Server stopped.
goto :eof

:: ==================== STATUS ====================
:status
cls
echo.
echo  -- Server --
if not exist "%PID_FILE%" goto status_server_stopped

set /p "pid=" < "%PID_FILE%"
tasklist /FI "PID eq !pid!" 2>nul | find "node" >nul
if errorlevel 1 goto status_server_stale

echo  Status: RUNNING (PID: !pid!)
echo  Local: http://localhost:3000
goto status_tunnel_check

:status_server_stale
echo  Status: STOPPED (stale PID)
del "%PID_FILE%" >nul 2>&1
goto status_tunnel_check

:status_server_stopped
echo  Status: STOPPED

:status_tunnel_check
echo.
echo  -- Cloudflare Tunnel --
if not exist "%TUNNEL_PID_FILE%" goto status_tunnel_not_running

set /p "tpid=" < "%TUNNEL_PID_FILE%"
tasklist /FI "PID eq !tpid!" 2>nul | find "cloudflared" >nul
if errorlevel 1 goto status_tunnel_stale

echo  Status: RUNNING (PID: !tpid!)
if exist "%DATA_DIR%\tunnel_url.txt" (
    set /p "tunnel_url=" < "%DATA_DIR%\tunnel_url.txt"
    echo  URL: !tunnel_url!
)
goto status_end

:status_tunnel_stale
echo  Status: NOT RUNNING (stale PID)
del "%TUNNEL_PID_FILE%" >nul 2>&1
goto status_end

:status_tunnel_not_running
echo  Status: NOT RUNNING

:status_end
echo.
pause
goto menu

:: ==================== SETUP TUNNEL ====================
:setup_tunnel
cls
echo.
echo  -- Cloudflare Tunnel Setup --
echo.
echo  Gives you a free HTTPS URL accessible from anywhere.
echo  No port forwarding needed.
echo.

call :ensure_cloudflared
if "!CF_EXE!"=="" goto menu

if "!LANG!"=="RU" (
    echo  [OK] cloudflared готов к работе.
    echo.
    echo  [1] Временный туннель ^(URL меняется^)
    echo  [2] Постоянный туннель ^(нужен аккаунт CF^)
    echo  [0] Отмена
) else (
    echo  [OK] cloudflared ready.
    echo.
    echo  [1] Quick Tunnel ^(temp URL^)
    echo  [2] Named Tunnel ^(permanent URL^)
    echo  [0] Cancel
)
echo.
set /p "tchoice=  Select: "

if "%tchoice%"=="0" goto menu

if "%tchoice%"=="1" goto setup_quick
if "%tchoice%"=="2" goto setup_named
goto menu

:setup_quick
    echo quick> "%DATA_DIR%\tunnel_mode.txt"
    echo.
    echo  [OK] Quick tunnel mode set.
    echo  Start it with option [7].
    echo  Note: URL changes each restart.
    pause
    goto menu

:setup_named
    echo.
    echo  Logging in to Cloudflare...
    cloudflared tunnel login
    echo.
    set /p "tunnel_name=  Tunnel name: "
    set /p "tunnel_domain=  Domain (e.g. manager.yourdomain.com): "

    if "!tunnel_name!"=="" (
        if "!LANG!"=="RU" ( echo  [ERROR] Имя обязательно. ) else ( echo  [ERROR] Name required. )
        pause
        goto menu
    )

    "!CF_EXE!" tunnel create !tunnel_name!
    "!CF_EXE!" tunnel route dns !tunnel_name! !tunnel_domain!

    echo named> "%DATA_DIR%\tunnel_mode.txt"
    echo !tunnel_name!> "%DATA_DIR%\tunnel_name.txt"
    echo https://!tunnel_domain!> "%DATA_DIR%\tunnel_url.txt"

    echo.
    echo  [OK] Tunnel configured: !tunnel_domain!
    pause
    goto menu
goto menu

:: ==================== START TUNNEL ====================
:start_tunnel
cls
echo.

call :ensure_cloudflared
if "!CF_EXE!"=="" goto menu

if not exist "%PID_FILE%" (
    echo  [WARN] Server not running. Start server first.
    pause
    goto menu
)

if exist "%TUNNEL_PID_FILE%" (
    set /p "old_tpid=" < "%TUNNEL_PID_FILE%"
    tasklist /FI "PID eq !old_tpid!" 2>nul | find "cloudflared" >nul
    if not errorlevel 1 (
        echo  [WARN] Tunnel already running (PID: !old_tpid!)
        pause
        goto menu
    )
)

set "TUNNEL_MODE=quick"
if exist "%DATA_DIR%\tunnel_mode.txt" (
    set /p "TUNNEL_MODE=" < "%DATA_DIR%\tunnel_mode.txt"
)

if "%TUNNEL_MODE%"=="named" (
    if exist "%DATA_DIR%\tunnel_name.txt" (
        set /p "TNAME=" < "%DATA_DIR%\tunnel_name.txt"
        if "!LANG!"=="RU" ( echo  Запуск постоянного туннеля: !TNAME!... ) else ( echo  Starting named tunnel: !TNAME!... )
        start "" /b cmd /c ""!CF_EXE!" tunnel --url http://localhost:3000 run !TNAME! > "%DATA_DIR%\tunnel.log" 2>&1"
    ) else (
        if "!LANG!"=="RU" ( echo  [ERROR] Имя туннеля не найдено. Выполните Настройку [6] еще раз. ) else ( echo  [ERROR] No tunnel name. Run Setup again. )
        pause
        goto menu
    )
) else (
    if "!LANG!"=="RU" ( echo  Запуск временного туннеля... ) else ( echo  Starting quick tunnel... )
    start "" /b cmd /c ""!CF_EXE!" tunnel --url http://localhost:3000 > "%DATA_DIR%\tunnel.log" 2>&1"
)

timeout /t 5 /nobreak >nul

for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq cloudflared.exe" /NH 2^>nul') do (
    set "TPID=%%a"
)
if defined TPID (
    set /a "TPID=!TPID!"
    if "!TPID!"=="0" set "TPID="
)

if not defined TPID goto tunnel_failed

    echo !TPID!> "%TUNNEL_PID_FILE%"
    echo  [OK] Tunnel started (PID: !TPID!)
    echo.
    if not "%TUNNEL_MODE%"=="quick" goto tunnel_named

:tunnel_quick
    echo  Waiting for URL...
    timeout /t 3 /nobreak >nul
    set "FOUND_URL="
    for /f "delims=" %%u in ('powershell -noprofile -command "$m = Select-String -Path '%DATA_DIR%\tunnel.log' -Pattern 'https://[^ ]+\.trycloudflare\.com' -ErrorAction SilentlyContinue; if($m){$m[0].Matches[0].Value}"') do set "FOUND_URL=%%u"
    if defined FOUND_URL (
        echo  [URL] !FOUND_URL!
        echo !FOUND_URL!> "%DATA_DIR%\tunnel_url.txt"
    ) else (
        echo  [WARN] URL not found yet. Check: %DATA_DIR%\tunnel.log
    )
    goto tunnel_success

:tunnel_named
    if exist "%DATA_DIR%\tunnel_url.txt" (
        set /p "turl=" < "%DATA_DIR%\tunnel_url.txt"
        echo  [URL] !turl!
    )
    goto tunnel_success

:tunnel_failed
    echo  [ERROR] Tunnel failed. Check %DATA_DIR%\tunnel.log

:tunnel_success
echo.
pause
goto menu

:: ==================== STOP TUNNEL ====================
:stop_tunnel
cls
echo.
call :do_stop_tunnel
pause
goto menu

:do_stop_tunnel
if not exist "%TUNNEL_PID_FILE%" (
    echo  [INFO] Tunnel not running.
    goto :eof
)
set /p "tpid=" < "%TUNNEL_PID_FILE%"
echo  Stopping tunnel (PID: %tpid%)...
taskkill /PID %tpid% /T /F >nul 2>&1
del "%TUNNEL_PID_FILE%" >nul 2>&1
echo  [OK] Tunnel stopped.
goto :eof

:: ==================== UTILS ====================
:ensure_cloudflared
set "CF_EXE=cloudflared"
where cloudflared >nul 2>&1
if not errorlevel 1 goto :eof

set "SYS_CF_DIR=%LOCALAPPDATA%\WinServerManager_Tools"
if not exist "%SYS_CF_DIR%" mkdir "%SYS_CF_DIR%"
set "SYS_CF_EXE=%SYS_CF_DIR%\cloudflared.exe"

:: Migrate old binary from data/bin or ROOT/bin to the system folder
if exist "%DATA_DIR%\bin\cloudflared.exe" (
    move /y "%DATA_DIR%\bin\cloudflared.exe" "!SYS_CF_EXE!" >nul 2>&1
)
if exist "%ROOT%bin\cloudflared.exe" (
    move /y "%ROOT%bin\cloudflared.exe" "!SYS_CF_EXE!" >nul 2>&1
)

if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
    set "CF_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
    goto :eof
)
if exist "!SYS_CF_EXE!" (
    set "CF_EXE=!SYS_CF_EXE!"
    goto :eof
)

if "!LANG!"=="RU" (
    echo  [WARN] cloudflared не найден в системе. Загрузка...
) else (
    echo  [WARN] cloudflared not found in system. Downloading...
)
powershell -noprofile -command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '!SYS_CF_EXE!'"
if exist "!SYS_CF_EXE!" (
    set "CF_EXE=!SYS_CF_EXE!"
    if "!LANG!"=="RU" ( echo  [OK] Успешно установлен в систему ^(!SYS_CF_DIR!^) ) else ( echo  [OK] Installed to system ^(!SYS_CF_DIR!^) )
    goto :eof
)
if "!LANG!"=="RU" ( echo  [ERROR] Ошибка загрузки. ) else ( echo  [ERROR] Download failed. )
set "CF_EXE="
pause
goto :eof
