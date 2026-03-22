# ====================================================================
# Win Server Manager - Auto Installer
# ====================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$repoUrl = "https://github.com/AngelNetw0rk/win-server-manager"
$installPath = "C:\WinServerManager"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Win Server Manager - Auto Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$langChoice = Read-Host "Choose language / Выберите язык [1 - EN, 2 - RU]"
$lang = if ($langChoice -eq '2') { 'RU' } else { 'EN' }

# 1. Сheck Directory
if (Test-Path $installPath) {
    if ($lang -eq 'RU') {
        Write-Host "[WARN] Папка $installPath уже существует!" -ForegroundColor Yellow
        $ans = Read-Host "Удалить и установить заново? (y/N)"
    } else {
        Write-Host "[WARN] Directory $installPath already exists!" -ForegroundColor Yellow
        $ans = Read-Host "Delete and reinstall? (y/N)"
    }
    
    if ($ans -eq 'y') {
        Remove-Item -Path $installPath -Recurse -Force
    } else {
        if ($lang -eq 'RU') { Write-Host "Установка отменена." -ForegroundColor Red }
        else { Write-Host "Installation cancelled." -ForegroundColor Red }
        exit
    }
}

if ($lang -eq 'RU') { Write-Host "[1/4] Подготовка папки $installPath..." -ForegroundColor Cyan }
else { Write-Host "[1/4] Preparing directory $installPath..." -ForegroundColor Cyan }

New-Item -ItemType Directory -Force -Path $installPath | Out-Null

# 2. Download from GitHub (via ZIP, no Git required)
$zipUrl = "$repoUrl/archive/refs/heads/main.zip"
$zipPath = "$env:TEMP\win_server_manager.zip"

if ($lang -eq 'RU') { Write-Host "[2/4] Скачивание с GitHub ($zipUrl)..." -ForegroundColor Cyan }
else { Write-Host "[2/4] Downloading from GitHub ($zipUrl)..." -ForegroundColor Cyan }

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
} catch {
    if ($lang -eq 'RU') { Write-Host "[ERROR] Не удалось скачать. Проверьте ссылку!" -ForegroundColor Red }
    else { Write-Host "[ERROR] Download failed. Check the URL!" -ForegroundColor Red }
    exit
}

# 3. Extracting
if ($lang -eq 'RU') { Write-Host "[3/4] Распаковка архива..." -ForegroundColor Cyan }
else { Write-Host "[3/4] Extracting archive..." -ForegroundColor Cyan }

Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\wsm_extract" -Force

$extractedFolder = Get-ChildItem -Path "$env:TEMP\wsm_extract" | Select-Object -First 1
Move-Item -Path "$($extractedFolder.FullName)\*" -Destination $installPath -Force

# Cleanup
Remove-Item -Path $zipPath -Force
Remove-Item -Path "$env:TEMP\wsm_extract" -Recurse -Force

# 4. Start manager.bat
if ($lang -eq 'RU') { Write-Host "[4/4] Запуск установки зависимостей..." -ForegroundColor Cyan }
else { Write-Host "[4/4] Starting dependency installation..." -ForegroundColor Cyan }

Set-Location $installPath

# CRITICAL FIX: GitHub ZIPs often convert CRLF to LF. 
# cmd.exe breaks and swallows characters if a bat file has LF line endings.
# We force convert it back to CRLF before execution.
$batContent = Get-Content "manager.bat" -Raw
$batContent = $batContent -replace "(?<!\r)\n", "`r`n"
Set-Content -Path "manager.bat" -Value $batContent -Force

cmd.exe /c "manager.bat"

Write-Host "=============================================" -ForegroundColor Green
if ($lang -eq 'RU') {
    Write-Host " УСТАНОВКА ЗАВЕРШЕНА!" -ForegroundColor Green
    Write-Host " Проект находится в: $installPath" -ForegroundColor White
    Write-Host " Закройте это окно или запустите manager.bat вручную." -ForegroundColor White
} else {
    Write-Host " INSTALLATION COMPLETE!" -ForegroundColor Green
    Write-Host " Project is now located at: $installPath" -ForegroundColor White
    Write-Host " Close this window or run manager.bat manually." -ForegroundColor White
}
Write-Host "=============================================" -ForegroundColor Green
