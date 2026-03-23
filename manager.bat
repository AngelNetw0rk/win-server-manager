@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Win Server Manager

set "ROOT=%~dp0"
set "DATA_DIR=%ROOT%data"
set "DB_FILE=%DATA_DIR%\manager.db"
set "PID_FILE=%DATA_DIR%\server.pid"
set "TUNNEL_PID_FILE=%DATA_DIR%\tunnel.pid"

set "SECURITY_FILE=%DATA_DIR%\security.json"
set "LANG=EN"
set "STRICT_MODE=false"

if exist "%SECURITY_FILE%" (
    for /f "tokens=1,2 delims=~" %%a in ('powershell -noprofile -command "$c=ConvertFrom-Json (Get-Content -Raw '%SECURITY_FILE%'); $l=$c.lang; if(!$l){$l='EN'}; $s=$c.strict_mode; if(!$s){$s='false'}elseif($s -eq $true){$s='true'}; Write-Output \"$l~$s\"" 2^>nul') do (
        set "LANG=%%a"
        set "STRICT_MODE=%%b"
    )
) else (
    if not "%~1"=="autorun" if not "%~1"=="silent_update" (
        cls
        echo.
        echo  ============================================
        echo       Win Server Manager - Language
        echo  ============================================
        echo.
        echo   [1] RU - Русский
        echo   [2] EN - English
        echo.
        set /p "lang_choice=  Select / Выберите: "
        if "!lang_choice!"=="1" (
            set "LANG=RU"
        ) else (
            set "LANG=EN"
        )
        if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
        powershell -noprofile -command "$j=@{lang='!LANG!';strict_mode=$false}|ConvertTo-Json; Set-Content -Path '%SECURITY_FILE%' -Value $j -Encoding UTF8"
    )
)

if "%~1"=="autorun" goto autorun
if "%~1"=="silent_update" goto silent_update

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js не найден в системе ^(Node.js is not recognized^).
    echo  Установите Node.js с официального сайта ^(https://nodejs.org^) 
    echo  или ПЕРЕЗАПУСТИТЕ эту консоль, если установка только что завершилась.
    echo.
    pause
    exit /b
)

if "!LANG!"=="RU" (
    set "M_INSTALL=[1] Установка                   - Загрузить зависимости и запустить Мастер настройки"
    set "M_UPDATE=[2] Обновление                  - Авто-обновление (OTA) с GitHub"
    set "M_START=[3] Запуск сервера              - Запустить Web-интерфейс (порт 3000)"
    set "M_STOP=[4] Остановка сервера           - Остановить все фоновые процессы Менеджера"
    set "M_STATUS=[5] Статус                      - Текущее состояние процессов и туннеля"
    set "M_TUNNEL_SET=[6] Настройка Cloudflare Tunnel - Безопасный доступ извне без белого IP (HTTPS)"
    set "M_TUNNEL_ON=[7] Запуск туннеля              - Включить настроенный HTTPS-туннель"
    set "M_TUNNEL_OFF=[8] Остановка туннеля           - Отключить HTTPS-туннель"
    set "M_SECURITY=[S] Настройка безопасности      - Юзеры, 2FA, Линейная защита (Strict Mode)"
    set "M_HELP=[H] Справка                   - Подробное описание всех функций Менеджера"
    set "M_EXIT=[0] Выход                     - Закрыть это окно"
) else (
    set "M_INSTALL=[1] Install                   - Download dependencies and run Setup Wizard"
    set "M_UPDATE=[2] Update                    - Over-the-air update from GitHub"
    set "M_START=[3] Start Server              - Launch Web Panel (port 3000)"
    set "M_STOP=[4] Stop Server               - Terminate all background Manager processes"
    set "M_STATUS=[5] Status                    - Current state of processes and tunnel"
    set "M_TUNNEL_SET=[6] Setup Cloudflare Tunnel   - Secure external access without public IP"
    set "M_TUNNEL_ON=[7] Start Tunnel              - Enable configured HTTPS tunnel"
    set "M_TUNNEL_OFF=[8] Stop Tunnel               - Disable HTTPS tunnel"
    set "M_SECURITY=[S] Security Settings         - Users, 2FA, Strict Mode"
    set "M_HELP=[H] Help                      - Detailed feature documentation"
    set "M_EXIT=[0] Exit                      - Close this window"
)

:menu
cls
set "MENU_VER=1.0"
if exist "%ROOT%VERSION" set /p "MENU_VER=" < "%ROOT%VERSION"
if "!LANG!"=="RU" ( set "M_SELECT=  Выбор: " ) else ( set "M_SELECT=  Select: " )
echo.
echo  ============================================
echo       Win Server Manager v!MENU_VER!
echo  ============================================
echo.
echo   !M_INSTALL!
echo   !M_UPDATE!
echo   !M_START!
echo   !M_STOP!
echo   !M_STATUS!
echo   !M_TUNNEL_SET!
echo   !M_TUNNEL_ON!
echo   !M_TUNNEL_OFF!
echo   !M_SECURITY!
echo   !M_HELP!
echo   !M_EXIT!
echo.
echo  ============================================
echo.
set /p "choice=!M_SELECT!"

if "%choice%"=="1" goto install
if "%choice%"=="2" goto update
if "%choice%"=="3" goto start_server
if "%choice%"=="4" goto stop_server
if "%choice%"=="5" goto status
if "%choice%"=="6" goto setup_tunnel
if "%choice%"=="7" goto start_tunnel
if "%choice%"=="8" goto stop_tunnel
if /i "%choice%"=="h" goto cmd_help
if /i "%choice%"=="s" goto security_settings
if "%choice%"=="0" exit /b
goto menu

:: ==================== SECURITY SETTINGS ====================
:security_settings
cls
echo.
echo  ============================================
if "!LANG!"=="RU" (
    echo   [Безопасность] Win Server Manager
) else (
    echo   [Security] Win Server Manager
)
echo  ============================================
echo.
if "!LANG!"=="RU" (
    echo   [1] Добавить нового пользователя
    echo   [2] Вкл/Выкл 2FA (Telegram)
    echo   [3] Вкл/Выкл Strict Mode
    echo   [L] Сменить язык
    echo   [0] Назад
) else (
    echo   [1] Add new user
    echo   [2] Toggle 2FA (Telegram)
    echo   [3] Toggle Strict Mode
    echo   [L] Change language
    echo   [0] Back
)
echo.
set /p "s_choice=!M_SELECT!"

if "%s_choice%"=="1" goto sec_add_user
if "%s_choice%"=="2" goto sec_toggle_2fa
if "%s_choice%"=="3" goto sec_toggle_strict
if /i "%s_choice%"=="l" goto sec_change_lang
if "%s_choice%"=="0" goto menu
goto security_settings

:sec_add_user
echo.
if "!LANG!"=="RU" (
    echo  [INFO] Ввод пароля скрыт для безопасности.
    set /p "new_user=  Логин (min 4): "
    echo | set /p ="  Пароль (min 4): "
) else (
    echo  [INFO] Password input is hidden for security.
    set /p "new_user=  Username (min 4): "
    echo | set /p ="  Password (min 4): "
)
set "new_pass="
for /f "delims=" %%i in ('powershell -noprofile -command "$p = read-host -AsSecureString; $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)"') do set "new_pass=%%i"

set "len_u=0"
set "len_p=0"
if defined new_user (
    for /f %%A in ('powershell -noprofile -command "'!new_user!'.length"') do set "len_u=%%A"
)
if defined new_pass (
    for /f %%A in ('powershell -noprofile -command "'!new_pass!'.length"') do set "len_p=%%A"
)

if !len_u! LSS 4 (
    if "!LANG!"=="RU" ( echo. & echo  [ERROR] Логин должен быть не короче 4 символов. ) else ( echo. & echo  [ERROR] Username must be at least 4 chars. )
    pause
    goto security_settings
)
if !len_p! LSS 4 (
    if "!LANG!"=="RU" ( echo. & echo  [ERROR] Пароль должен быть не короче 4 символов. ) else ( echo. & echo  [ERROR] Password must be at least 4 chars. )
    pause
    goto security_settings
)

node -e "try{require('./modules/security').createUser('%new_user%','%new_pass%');console.log('  [OK] User created.')}catch(e){console.log('  [ERROR] '+e.message)}"
pause
goto security_settings

:sec_toggle_2fa
echo.
if "!STRICT_MODE!"=="true" (
    if "!LANG!"=="RU" (
        echo  [ERROR] Включен Strict Mode. Снятие блокировок возможно ТОЛЬКО через Telegram-бота главного администратора.
    ) else (
        echo  [ERROR] Strict Mode is ON. Unlocking is ONLY possible via the main administrator's Telegram bot.
    )
    pause
    goto security_settings
)
if "!LANG!"=="RU" ( echo  Фича 2FA будет реализована позже. ) else ( echo  2FA feature will be implemented soon. )
pause
goto security_settings

:sec_toggle_strict
echo.
if "!STRICT_MODE!"=="true" (
    if "!LANG!"=="RU" (
        echo  [ERROR] Включен Strict Mode. Понижение безопасности возможно ТОЛЬКО через Telegram-бота главного администратора.
    ) else (
        echo  [ERROR] Strict Mode is ON. Disabling is ONLY possible via the main administrator's Telegram bot.
    )
    pause
    goto security_settings
) else (
    set "NEW_STRICT=true"
    if "!LANG!"=="RU" ( echo  Включение Strict Mode... ) else ( echo  Enabling Strict Mode... )
)
node -e "try{require('./modules/security').setStrictMode(%NEW_STRICT%);console.log('  [OK] Strict mode changed.')}catch(e){console.log('  [ERROR] '+e.message)}"
set "STRICT_MODE=!NEW_STRICT!"
pause
goto security_settings

:sec_change_lang
echo.
echo   [1] RU - Русский
echo   [2] EN - English
echo.
set /p "new_lang=!M_SELECT!"
if "!new_lang!"=="1" (
    set "LANG=RU"
) else (
    set "LANG=EN"
)
powershell -noprofile -command "$f='%SECURITY_FILE%'; if(Test-Path $f){$c=Get-Content -Raw $f|ConvertFrom-Json; $c.lang='!LANG!'; $c|ConvertTo-Json|Set-Content $f -Encoding UTF8}else{@{lang='!LANG!';strict_mode=$false}|ConvertTo-Json|Set-Content $f -Encoding UTF8}"
if "!LANG!"=="RU" (
    set "M_INSTALL=[1] Установка                   - Загрузить зависимости и запустить Мастер настройки"
    set "M_UPDATE=[2] Обновление                  - Авто-обновление (OTA) с GitHub"
    set "M_START=[3] Запуск сервера              - Запустить Web-интерфейс (порт 3000)"
    set "M_STOP=[4] Остановка сервера           - Остановить все фоновые процессы Менеджера"
    set "M_STATUS=[5] Статус                      - Текущее состояние процессов и туннеля"
    set "M_TUNNEL_SET=[6] Настройка Cloudflare Tunnel - Безопасный доступ извне без белого IP (HTTPS)"
    set "M_TUNNEL_ON=[7] Запуск туннеля              - Включить настроенный HTTPS-туннель"
    set "M_TUNNEL_OFF=[8] Остановка туннеля           - Отключить HTTPS-туннель"
    set "M_SECURITY=[S] Настройка безопасности      - Юзеры, 2FA, Линейная защита (Strict Mode)"
    set "M_HELP=[H] Справка                   - Подробное описание всех функций Менеджера"
    set "M_EXIT=[0] Выход                     - Закрыть это окно"
    echo  [OK] Язык изменен на Русский.
) else (
    set "M_INSTALL=[1] Install                   - Download dependencies and run Setup Wizard"
    set "M_UPDATE=[2] Update                    - Over-the-air update from GitHub"
    set "M_START=[3] Start Server              - Launch Web Panel (port 3000)"
    set "M_STOP=[4] Stop Server               - Terminate all background Manager processes"
    set "M_STATUS=[5] Status                    - Current state of processes and tunnel"
    set "M_TUNNEL_SET=[6] Setup Cloudflare Tunnel   - Secure external access without public IP"
    set "M_TUNNEL_ON=[7] Start Tunnel              - Enable configured HTTPS tunnel"
    set "M_TUNNEL_OFF=[8] Stop Tunnel               - Disable HTTPS tunnel"
    set "M_SECURITY=[S] Security Settings         - Users, 2FA, Strict Mode"
    set "M_HELP=[H] Help                      - Detailed feature documentation"
    set "M_EXIT=[0] Exit                      - Close this window"
    echo  [OK] Language changed to English.
)
pause
goto menu

:: ==================== SILENT UPDATE ====================
:silent_update
set "SILENT_MODE=1"
call :do_stop
call :do_stop_tunnel
:: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
:: Укажи здесь свой репозиторий: "username/repo"
set "REPO=AngelNetw0rk/win-server-manager"
set "BRANCH=main"
:: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
goto do_update_start

:: ==================== AUTORUN ====================
:autorun
cd /d "%ROOT%"
if exist "%PID_FILE%" (
    set /p "old_pid=" < "%PID_FILE%"
    tasklist /FI "PID eq !old_pid!" 2>nul | find "node" >nul
    if not errorlevel 1 goto autorun_tunnel
    del "%PID_FILE%" >nul 2>&1
)
start "" /b cmd /c "node server.js > "%DATA_DIR%\server.log" 2>&1"

:autorun_tunnel
timeout /t 5 /nobreak >nul
set "TUNNEL_MODE=none"
if exist "%DATA_DIR%\tunnel_mode.txt" set /p "TUNNEL_MODE=" < "%DATA_DIR%\tunnel_mode.txt"
if "!TUNNEL_MODE!"=="named" (
    if exist "%DATA_DIR%\tunnel_name.txt" (
        set /p "TNAME=" < "%DATA_DIR%\tunnel_name.txt"
        call :ensure_cloudflared
        if not "!CF_EXE!"=="" (
            if not exist "%TUNNEL_PID_FILE%" (
                start "" /b cmd /c ""!CF_EXE!" tunnel --url http://localhost:3000 run !TNAME! > "%DATA_DIR%\tunnel.log" 2>&1"
            ) else (
                set /p "old_tpid=" < "%TUNNEL_PID_FILE%"
                tasklist /FI "PID eq !old_tpid!" 2>nul | find "cloudflared" >nul
                if errorlevel 1 (
                    del "%TUNNEL_PID_FILE%" >nul 2>&1
                    start "" /b cmd /c ""!CF_EXE!" tunnel --url http://localhost:3000 run !TNAME! > "%DATA_DIR%\tunnel.log" 2>&1"
                )
            )
        )
    )
)
exit /b

:silent_setup_autorun
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\WinServerManager_Autorun.vbs"
echo Set WshShell = CreateObject^("WScript.Shell"^) > "%VBS_FILE%"
echo WshShell.Run chr^(34^) ^& "%ROOT%manager.bat" ^& Chr^(34^) ^& " autorun", 0 >> "%VBS_FILE%"
goto :eof

:cmd_help
cls
echo.
echo  ============================================
echo       Win Server Manager : HELP / DOCS
echo  ============================================
echo.
if "!LANG!"=="RU" (
    echo  ПРОЕКТ: Автономный локальный диспетчер процессов для Windows Server.
    echo.
    echo  1. Сервер и Broker: Важно понимать, что есть Web-Сервер ^(Порт 3000^) и PTY Broker.
    echo     Broker работает независимо и держит консольные приложения открытыми.
    echo     Даже при краше Web-Сервера или обновлении, ваши софты продолжат работать.
    echo  2. Автозагрузка: Менеджер автоматически стартует вместе с Windows в фоне.
    echo     Никаких окон не появляется, все логи пишутся в папку data\server.log.
    echo  3. Cloudflare Tunnel: Если у вас нет "белого" IP, настройте туннель ^(пункт 6^).
    echo     Он создаст безопасный прямой линк до панели из любой точки мира.
    echo     Рекомендуется "Постоянный туннель"^, чтобы URL не менялся после перезапуска.
    echo  4. Strict Mode: Если включен, никто не сможет отключить безопасность
    echo     прямо с клавиатуры сервера. Это защита от RDP взломов.
    echo  5. Обновление: "Обновление по воздуху" ^(OTA^) не затронет ваши пароли и БД.
    echo     Процессы софтов не остановятся во время бесшумного обновления.
) else (
    echo  PROJECT: Autonomous local process dispatcher for Windows Server.
    echo.
    echo  1. Server and Broker: There is a Web Server ^(Port 3000^) and a PTY Broker.
    echo     The Broker acts independently, keeping your console apps alive.
    echo     Even if the Web Server crashes or updates, your scripts won't stop.
    echo  2. Autorun: The Manager starts automatically with Windows silently.
    echo     No windows will pop up, logs are saved to data\server.log.
    echo  3. Cloudflare Tunnel: Without a public IP, use the Tunnel ^(option 6^).
    echo     It creates a secure direct link to the panel from anywhere.
    echo     Use "Named Tunnel" so your URL stays identical across reboots.
    echo  4. Strict Mode: When enabled, nobody can disable security settings
    echo     from the local server keyboard. Protects against local RDP hacks.
    echo  5. Update: "Over-The-Air" ^(OTA^) updates won't delete passwords or DB.
    echo     Software processes will not be interrupted during updates.
)
echo.
pause
goto menu

:: ==================== INSTALL ====================
:install
cls
echo.
if exist "%SECURITY_FILE%" (
    if "!LANG!"=="RU" (
        echo  [INFO] Система уже установлена и настроена.
        echo  Если вы хотите переустановить сервер, сначала удалите папку data.
    ) else (
        echo  [INFO] System is already installed.
        echo  To reinstall, please delete the data folder first.
    )
    echo.
    pause
    goto menu
)
if "!LANG!"=="RU" (
    echo  [Установка] Проверка требований...
) else (
    echo  [Install] Checking prerequisites...
)
echo.

where node >nul 2>&1
if errorlevel 1 (
    if "!LANG!"=="RU" (
        echo  [ERROR] Node.js не найден.
        echo  Скачайте: https://nodejs.org/
    ) else (
        echo  [ERROR] Node.js not found.
        echo  Download: https://nodejs.org/
    )
    pause
    goto menu
)
for /f "tokens=*" %%i in ('node -v') do set "NODE_VER=%%i"
echo  [OK] Node.js %NODE_VER%

where npm >nul 2>&1
if errorlevel 1 (
    if "!LANG!"=="RU" (
        echo  [ERROR] npm не найден.
    ) else (
        echo  [ERROR] npm not found.
    )
    pause
    goto menu
)
for /f "tokens=*" %%i in ('npm -v') do set "NPM_VER=%%i"
echo  [OK] npm v%NPM_VER%

if not exist "%DATA_DIR%" (
    mkdir "%DATA_DIR%"
    if "!LANG!"=="RU" ( echo  [OK] Папка data создана ) else ( echo  [OK] Created data directory )
)

echo.
if "!LANG!"=="RU" ( echo  Установка зависимостей... ) else ( echo  Installing dependencies... )
echo.
cd /d "%ROOT%"
call npm install
if errorlevel 1 (
    echo.
    if "!LANG!"=="RU" (
        echo  [ERROR] npm install завершился с ошибкой.
        echo  Если node-pty не установился, выполните:
    ) else (
        echo  [ERROR] npm install failed.
        echo  If node-pty fails, run:
    )
    echo  npm install --global windows-build-tools
    pause
    goto menu
)
echo.
if "!LANG!"=="RU" ( echo  [OK] Зависимости установлены. ) else ( echo  [OK] Dependencies installed. )

echo.
echo  ============================================
if "!LANG!"=="RU" (
    echo   Мастер Первоначальной Настройки
    set "W_S1_TITLE=[ШАГ 1 из 3] Создание учетной записи Администратора (ОБЯЗАТЕЛЬНО)"
    set "W_S1_DESC=Ввод пароля скрыт для безопасности."
    set "W_S1_USER=  Логин (min 4): "
    set "W_S1_PASS=  Пароль (min 4): "
    set "W_S1_ERR_U=[ERROR] Регистрация прервана. Логин слишком короткий."
    set "W_S1_ERR_P=[ERROR] Регистрация прервана. Пароль слишком короткий."
    set "W_S2_TITLE=[ШАГ 2 из 3] Настройка Telegram 2FA (ОПЦИОНАЛЬНО)"
    set "W_S2_DESC=Защищает каждую попытку входа запросом в Telegram бота."
    set "W_S2_ASK=  Включить 2FA сейчас? (Y/n): "
    set "W_S3_TITLE=[ШАГ 3 из 3] Включение Strict Mode (ОПЦИОНАЛЬНО)"
    set "W_S3_DESC1=БЛОКИРУЕТ отключение безопасности через ручное консольное меню."
    set "W_S3_DESC2=Защищает от ситуаций, когда хакер получил прямой доступ к RDP."
    set "W_S3_ASK=  Включить Strict Mode? (Y/n): "
    set "W_OK=Установка и автонастройка завершены!"
    set "W_OK2=Ярлык добавлен в скрытую автозагрузку ОС."
    set "W_OK3=Запустите сервер через пункт меню [3]."
) else (
    echo   Initial Setup Wizard
    set "W_S1_TITLE=[STEP 1 of 3] Create Administrator Account (REQUIRED)"
    set "W_S1_DESC=Password input is hidden for security."
    set "W_S1_USER=  Username (min 4): "
    set "W_S1_PASS=  Password (min 4): "
    set "W_S1_ERR_U=[ERROR] Setup aborted. Username too short."
    set "W_S1_ERR_P=[ERROR] Setup aborted. Password too short."
    set "W_S2_TITLE=[STEP 2 of 3] Telegram 2FA Setup (OPTIONAL)"
    set "W_S2_DESC=Protects every login with a Telegram prompt."
    set "W_S2_ASK=  Enable 2FA now? (Y/n): "
    set "W_S3_TITLE=[STEP 3 of 3] Enable Strict Mode (OPTIONAL)"
    set "W_S3_DESC1=BLOCKS disabling security settings through this console menu."
    set "W_S3_DESC2=Protects against manual overrides via direct local RDP access."
    set "W_S3_ASK=  Enable Strict Mode? (Y/n): "
    set "W_OK=Setup wizard is complete!"
    set "W_OK2=Hidden autorun shortcut added to OS startup."
    set "W_OK3=Start server with option [3]."
)
echo  ============================================
echo.

echo   !W_S1_TITLE!
echo   !W_S1_DESC!
set /p "admin_user=!W_S1_USER!"
echo | set /p ="!W_S1_PASS!"

set "admin_pass="
for /f "delims=" %%i in ('powershell -noprofile -command "$p = read-host -AsSecureString; [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"') do set "admin_pass=%%i"

set "len_u=0"
set "len_p=0"
if defined admin_user (
    for /f %%A in ('powershell -noprofile -command "'!admin_user!'.length"') do set "len_u=%%A"
)
if defined admin_pass (
    for /f %%A in ('powershell -noprofile -command "'!admin_pass!'.length"') do set "len_p=%%A"
)

if !len_u! LSS 4 (
    echo. & echo  !W_S1_ERR_U!
    pause
    goto menu
)
if !len_p! LSS 4 (
    echo. & echo  !W_S1_ERR_P!
    pause
    goto menu
)

node -e "try{require('./modules/security').createUser('%admin_user%','%admin_pass%');console.log('  [OK] Admin created: %admin_user%')}catch(e){console.log('  [WARN] '+e.message)}"

echo.
echo   !W_S2_TITLE!
echo   !W_S2_DESC!
set /p "ask_2fa=!W_S2_ASK!"

if /i "!ask_2fa!"=="y" (
    if "!LANG!"=="RU" ( echo   Фича 2FA будет реализована позже. ) else ( echo   2FA feature will be implemented soon. )
)

echo.
echo   !W_S3_TITLE!
echo   !W_S3_DESC1!
echo   !W_S3_DESC2!
set /p "ask_strict=!W_S3_ASK!"

if /i "!ask_strict!"=="y" (
    node -e "try{require('./modules/security').setStrictMode(true);console.log('  [OK] Strict mode ENABLED.')}catch(e){console.log('  [ERROR] '+e.message)}"
    set "STRICT_MODE=true"
)

call :silent_setup_autorun

echo.
echo  ============================================
echo   !W_OK!
echo   !W_OK2!
echo   !W_OK3!
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

if "!LANG!"=="RU" (
    echo  Текущая версия:   !CUR_VER!
    echo  Проверка GitHub для "!REPO!"...
) else (
    echo  Current Version:  !CUR_VER!
    echo  Checking GitHub for "!REPO!"...
)

:: 1. Проверка новой версии
for /f "delims=" %%v in ('powershell -noprofile -command "(Invoke-RestMethod -Uri 'https://raw.githubusercontent.com/%REPO%/%BRANCH%/VERSION' -ErrorAction SilentlyContinue).Trim()"') do set "REMOTE_VER=%%v"

if "!REMOTE_VER!"=="" (
    if "!LANG!"=="RU" (
        echo  [ERROR] Не удалось получить версию с сервера.
        echo  Проверьте переменную REPO в manager.bat!
    ) else (
        echo  [ERROR] Cannot fetch remote version.
        echo  Make sure the REPO variable is correct in manager.bat!
    )
    pause
    goto menu
)

if "!LANG!"=="RU" ( echo  Последняя версия: !REMOTE_VER! ) else ( echo  Latest Version:   !REMOTE_VER! )

if "!CUR_VER!"=="!REMOTE_VER!" goto update_same_ver

    echo.
    if "!LANG!"=="RU" (
        set /p "do_update=  Обновить до !REMOTE_VER!? (Y/n): "
    ) else (
        set /p "do_update=  Update to !REMOTE_VER!? (Y/n): "
    )
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
if "!LANG!"=="RU" ( echo  [1/3] Создание резервной копии... ) else ( echo  [1/3] Creating Backup... )
set "TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "BACKUP_DIR=%DATA_DIR%\backups\backup_%TIMESTAMP%"

mkdir "%BACKUP_DIR%"
if exist "%DB_FILE%" copy /y "%DB_FILE%" "%BACKUP_DIR%\manager.db" >nul
if exist "%DATA_DIR%\*.log" copy /y "%DATA_DIR%\*.log" "%BACKUP_DIR%\" >nul
if exist "%ROOT%VERSION" copy /y "%ROOT%VERSION" "%BACKUP_DIR%" >nul

if "!LANG!"=="RU" ( echo  [OK] Бэкап сохранен: data/backups/backup_%TIMESTAMP% ) else ( echo  [OK] Data backed up to: data/backups/backup_%TIMESTAMP% )
echo.

:: 3. TRANSFER CONTROL TO TEMP UPDATER TO AVOID CMD BYTE SHIFT CRASH
if "!LANG!"=="RU" ( echo  [2/3] Подготовка апдейтера... ) else ( echo  [2/3] Preparing Updater... )

set "UPDATER_BAT=%TEMP%\wsm_upd_%RANDOM%.bat"
(
echo @echo off
echo chcp 65001 ^^>nul
echo echo  [2/3] Downloading updates from GitHub...
echo powershell -noprofile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $zip = Join-Path $env:TEMP 'wsm_upd.zip'; $ext = Join-Path $env:TEMP 'wsm_ext'; Invoke-WebRequest -Uri 'https://github.com/%%REPO%%/archive/refs/heads/%%BRANCH%%.zip' -OutFile $zip; if(Test-Path $ext){Remove-Item $ext -Recurse -Force}; Expand-Archive -Path $zip -DestinationPath $ext -Force; $src = Get-ChildItem $ext | Select-Object -First 1; $srcPath = Join-Path $src.FullName '*'; Copy-Item -Path $srcPath -Destination '%%ROOT%%' -Recurse -Force; Remove-Item $zip -Force; Remove-Item $ext -Recurse -Force; Write-Host '  [OK] Downloaded and extracted.'; exit 0 } catch { Write-Host \"  [ERROR] Download failed. $_\" -ForegroundColor Red; exit 1 }"
echo if %%ERRORLEVEL%% NEQ 0 ^( pause ^& "%%ROOT%%manager.bat" ^& exit /b ^)
echo echo.
echo echo  [3/3] Reinstalling dependencies...
echo cd /d "%%ROOT%%"
echo call npm install --no-fund --no-audit
echo if %%ERRORLEVEL%% NEQ 0 ^( echo  [ERROR] npm install failed. ^& pause ^& "%%ROOT%%manager.bat" ^& exit /b ^)
echo if exist "%%ROOT%%modules\migrate.js" ^( echo  Running database migrations... ^& node modules\migrate.js ^)
echo echo.
echo echo  ============================================
echo echo  [OK] Update Complete!
echo if exist "%%ROOT%%VERSION" set /p "NEW_VER=" ^< "%%ROOT%%VERSION"
echo if exist "%%ROOT%%VERSION" call echo  Version is now: %%%%NEW_VER%%%%
echo if not "%%%%CHANGELOG%%%%"=="" ^(
echo     if "%%%%LANG%%%%"=="RU" ^( powershell -noprofile -command "Write-Host \"  Что добавлено: %%%%CHANGELOG%%%%\" -ForegroundColor Green" ^) else ^( powershell -noprofile -command "Write-Host \"  What's new: %%%%CHANGELOG%%%%\" -ForegroundColor Green" ^)
echo ^)
echo echo  Your data and settings were preserved.
echo echo  ============================================
echo echo.
echo set "STARTUP_DIR=%%%%APPDATA%%%%\Microsoft\Windows\Start Menu\Programs\Startup"
echo set "VBS_FILE=%%%%STARTUP_DIR%%%%\WinServerManager_Autorun.vbs"
echo echo Set WshShell = CreateObject^^("WScript.Shell"^^) ^> "%%%%VBS_FILE%%%%"
echo echo WshShell.Run chr^^(34^^) ^^& "%%ROOT%%manager.bat" ^^& Chr^^(34^^) ^^& " autorun", 0 ^>^> "%%%%VBS_FILE%%%%"
echo if "%%%%SILENT_MODE%%%%"=="1" goto silent_exit
echo pause
echo "%%ROOT%%manager.bat"
echo exit /b
echo :silent_exit
echo start "" /b cmd /c "%%ROOT%%manager.bat" autorun
echo exit /b
) > "!UPDATER_BAT!"

"!UPDATER_BAT!"

:: ==================== START SERVER ====================
:start_server
cls
echo.

if exist "%PID_FILE%" (
    set /p "old_pid=" < "%PID_FILE%"
    tasklist /FI "PID eq !old_pid!" 2>nul | find "node" >nul
    if not errorlevel 1 (
        if "!LANG!"=="RU" ( echo  [WARN] Сервер уже запущен ^(PID: !old_pid!^) ) else ( echo  [WARN] Server already running ^(PID: !old_pid!^) )
        pause
        goto menu
    )
    :: Stale PID file, remove it
    del "%PID_FILE%" >nul 2>&1
)

if not exist "%ROOT%node_modules" (
    if "!LANG!"=="RU" ( echo  [ERROR] Не установлено. Сначала выполните Установку [1]. ) else ( echo  [ERROR] Not installed. Run Install first. )
    pause
    goto menu
)

if "!LANG!"=="RU" ( echo  Запуск сервера... ) else ( echo  Starting server... )
cd /d "%ROOT%"

:: Clear old PID file so we can detect new one
if exist "%PID_FILE%" del "%PID_FILE%" >nul 2>&1

start "" /b cmd /c "node server.js > "%DATA_DIR%\server.log" 2>&1"

:: Wait for server to write its own PID file (up to 10 seconds)
if "!LANG!"=="RU" ( echo  Ожидание запуска сервера... ) else ( echo  Waiting for server to start... )
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
if "!LANG!"=="RU" ( echo  Для внешнего доступа используйте пункт [7] ^(Запуск туннеля^) ) else ( echo  For external access use option [7] ^(Start Tunnel^) )
echo.
pause
goto menu

:pid_fail
if "!LANG!"=="RU" (
    echo  [ERROR] Сервер не запустился за 10 секунд.
    echo  Проверьте лог: %DATA_DIR%\server.log
) else (
    echo  [ERROR] Server did not start in 10 seconds.
    echo  Check log: %DATA_DIR%\server.log
)
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
    if "!LANG!"=="RU" ( echo  [INFO] Сервер не запущен. ) else ( echo  [INFO] Server not running. )
    goto :eof
)
set /p "pid=" < "%PID_FILE%"
if "!LANG!"=="RU" ( echo  Остановка сервера ^(PID: %pid%^)... ) else ( echo  Stopping server ^(PID: %pid%^)... )
taskkill /PID %pid% /T /F >nul 2>&1
del "%PID_FILE%" >nul 2>&1
if "!LANG!"=="RU" ( echo  [OK] Сервер остановлен. ) else ( echo  [OK] Server stopped. )
goto :eof

:: ==================== STATUS ====================
:status
cls
echo.
if "!LANG!"=="RU" ( echo  -- Сервер -- ) else ( echo  -- Server -- )
if not exist "%PID_FILE%" goto status_server_stopped

set /p "pid=" < "%PID_FILE%"
tasklist /FI "PID eq !pid!" 2>nul | find "node" >nul
if errorlevel 1 goto status_server_stale

if "!LANG!"=="RU" ( echo  Статус: РАБОТАЕТ ^(PID: !pid!^) ) else ( echo  Status: RUNNING ^(PID: !pid!^) )
echo  Local: http://localhost:3000
goto status_tunnel_check

:status_server_stale
if "!LANG!"=="RU" ( echo  Статус: ОСТАНОВЛЕН ^(устаревший PID^) ) else ( echo  Status: STOPPED ^(stale PID^) )
del "%PID_FILE%" >nul 2>&1
goto status_tunnel_check

:status_server_stopped
if "!LANG!"=="RU" ( echo  Статус: ОСТАНОВЛЕН ) else ( echo  Status: STOPPED )

:status_tunnel_check
echo.
echo  -- Cloudflare Tunnel --
if not exist "%TUNNEL_PID_FILE%" goto status_tunnel_not_running

set /p "tpid=" < "%TUNNEL_PID_FILE%"
tasklist /FI "PID eq !tpid!" 2>nul | find "cloudflared" >nul
if errorlevel 1 goto status_tunnel_stale

if "!LANG!"=="RU" ( echo  Статус: РАБОТАЕТ ^(PID: !tpid!^) ) else ( echo  Status: RUNNING ^(PID: !tpid!^) )
if exist "%DATA_DIR%\tunnel_url.txt" (
    set /p "tunnel_url=" < "%DATA_DIR%\tunnel_url.txt"
    echo  URL: !tunnel_url!
)
goto status_end

:status_tunnel_stale
if "!LANG!"=="RU" ( echo  Статус: НЕ РАБОТАЕТ ^(устаревший PID^) ) else ( echo  Status: NOT RUNNING ^(stale PID^) )
del "%TUNNEL_PID_FILE%" >nul 2>&1
goto status_end

:status_tunnel_not_running
if "!LANG!"=="RU" ( echo  Статус: НЕ РАБОТАЕТ ) else ( echo  Status: NOT RUNNING )

:status_end
echo.
pause
goto menu

:: ==================== SETUP TUNNEL ====================
:setup_tunnel
cls
echo.
if "!LANG!"=="RU" (
    echo  -- Настройка Cloudflare Tunnel --
    echo.
    echo  Бесплатный HTTPS-адрес доступный из любой точки мира.
    echo  Проброс портов не требуется.
) else (
    echo  -- Cloudflare Tunnel Setup --
    echo.
    echo  Gives you a free HTTPS URL accessible from anywhere.
    echo  No port forwarding needed.
)
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
    if "!LANG!"=="RU" (
        echo  [OK] Режим временного туннеля установлен.
        echo  Запустите его через пункт [7].
        echo  URL будет меняться при каждом перезапуске.
    ) else (
        echo  [OK] Quick tunnel mode set.
        echo  Start it with option [7].
        echo  Note: URL changes each restart.
    )
    pause
    goto menu

:setup_named
    echo.
    if "!LANG!"=="RU" ( echo  Вход в Cloudflare... ) else ( echo  Logging in to Cloudflare... )
    cloudflared tunnel login
    echo.
    if "!LANG!"=="RU" (
        set /p "tunnel_name=  Имя туннеля: "
        set /p "tunnel_domain=  Домен (например manager.yourdomain.com): "
    ) else (
        set /p "tunnel_name=  Tunnel name: "
        set /p "tunnel_domain=  Domain (e.g. manager.yourdomain.com): "
    )

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
    if "!LANG!"=="RU" ( echo  [OK] Туннель настроен: !tunnel_domain! ) else ( echo  [OK] Tunnel configured: !tunnel_domain! )
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
    if "!LANG!"=="RU" ( echo  [WARN] Сервер не запущен. Сначала запустите сервер. ) else ( echo  [WARN] Server not running. Start server first. )
    pause
    goto menu
)

if exist "%TUNNEL_PID_FILE%" (
    set /p "old_tpid=" < "%TUNNEL_PID_FILE%"
    tasklist /FI "PID eq !old_tpid!" 2>nul | find "cloudflared" >nul
    if not errorlevel 1 (
        if "!LANG!"=="RU" ( echo  [WARN] Туннель уже запущен ^(PID: !old_tpid!^) ) else ( echo  [WARN] Tunnel already running ^(PID: !old_tpid!^) )
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
    if "!LANG!"=="RU" ( echo  [OK] Туннель запущен ^(PID: !TPID!^) ) else ( echo  [OK] Tunnel started ^(PID: !TPID!^) )
    echo.
    if not "%TUNNEL_MODE%"=="quick" goto tunnel_named

:tunnel_quick
    if "!LANG!"=="RU" ( echo  Ожидание URL... ) else ( echo  Waiting for URL... )
    timeout /t 3 /nobreak >nul
    set "FOUND_URL="
    for /f "delims=" %%u in ('powershell -noprofile -command "$m = Select-String -Path '%DATA_DIR%\tunnel.log' -Pattern 'https://[^ ]+\.trycloudflare\.com' -ErrorAction SilentlyContinue; if($m){$m[0].Matches[0].Value}"') do set "FOUND_URL=%%u"
    if defined FOUND_URL (
        echo  [URL] !FOUND_URL!
        echo !FOUND_URL!> "%DATA_DIR%\tunnel_url.txt"
    ) else (
        if "!LANG!"=="RU" ( echo  [WARN] URL пока не найден. Проверьте: %DATA_DIR%\tunnel.log ) else ( echo  [WARN] URL not found yet. Check: %DATA_DIR%\tunnel.log )
    )
    goto tunnel_success

:tunnel_named
    if exist "%DATA_DIR%\tunnel_url.txt" (
        set /p "turl=" < "%DATA_DIR%\tunnel_url.txt"
        echo  [URL] !turl!
    )
    goto tunnel_success

:tunnel_failed
    if "!LANG!"=="RU" ( echo  [ERROR] Сбой туннеля. Проверьте %DATA_DIR%\tunnel.log ) else ( echo  [ERROR] Tunnel failed. Check %DATA_DIR%\tunnel.log )

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
    if "!LANG!"=="RU" ( echo  [INFO] Туннель не запущен. ) else ( echo  [INFO] Tunnel not running. )
    goto :eof
)
set /p "tpid=" < "%TUNNEL_PID_FILE%"
if "!LANG!"=="RU" ( echo  Остановка туннеля ^(PID: %tpid%^)... ) else ( echo  Stopping tunnel ^(PID: %tpid%^)... )
taskkill /PID %tpid% /T /F >nul 2>&1
del "%TUNNEL_PID_FILE%" >nul 2>&1
if "!LANG!"=="RU" ( echo  [OK] Туннель остановлен. ) else ( echo  [OK] Tunnel stopped. )
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
