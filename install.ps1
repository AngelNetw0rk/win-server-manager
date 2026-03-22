# ====================================================================
# Win Server Manager - Полноценный авто-инсталлятор для нового сервера
# ====================================================================

$repoUrl = "https://github.com/AngelNetw0rk/win-server-manager"
$installPath = "C:\WinServerManager"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Win Server Manager - Auto Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Проверка директории
if (Test-Path $installPath) {
    Write-Host "[WARN] Папка $installPath уже существует!" -ForegroundColor Yellow
    $ans = Read-Host "Удалить и установить заново? (y/N)"
    if ($ans -eq 'y') {
        Remove-Item -Path $installPath -Recurse -Force
    } else {
        Write-Host "Установка отменена." -ForegroundColor Red
        exit
    }
}

Write-Host "[1/4] Подготовка папки $installPath..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $installPath | Out-Null

# 2. Скачивание (через ZIP, чтобы не требовать установленного Git на новом сервере)
$zipUrl = "$repoUrl/archive/refs/heads/main.zip"
$zipPath = "$env:TEMP\win_server_manager.zip"

Write-Host "[2/4] Скачивание с GitHub ($zipUrl)..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
} catch {
    Write-Host "[ERROR] Не удалось скачать. Проверь ссылку или если репо приватный, этот метод скачивания без токена не сработает!" -ForegroundColor Red
    exit
}

# 3. Распаковка
Write-Host "[3/4] Распаковка архива..." -ForegroundColor Cyan
Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\wsm_extract" -Force

# GitHub ZIP внутри имеет папку "win-server-manager-main", перемещаем её содержимое
$extractedFolder = Get-ChildItem -Path "$env:TEMP\wsm_extract" | Select-Object -First 1
Move-Item -Path "$($extractedFolder.FullName)\*" -Destination $installPath -Force

# Очистка мусора
Remove-Item -Path $zipPath -Force
Remove-Item -Path "$env:TEMP\wsm_extract" -Recurse -Force

# 4. Запуск manager.bat (Install)
Write-Host "[4/4] Запуск установки зависимостей..." -ForegroundColor Cyan
Set-Location $installPath
cmd.exe /c "manager.bat"

Write-Host "=============================================" -ForegroundColor Green
Write-Host " УСТАНОВКА ЗАВЕРШЕНА!" -ForegroundColor Green
Write-Host " Твой проект теперь находится в: $installPath" -ForegroundColor White
Write-Host " Для управления перейди в $installPath и закрой/открой manager.bat" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor Green
