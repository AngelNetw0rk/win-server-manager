# ====================================================================
# Win Server Manager - Auto Installer
# ====================================================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function ru($b) { return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b)) }

$repoUrl = "https://github.com/AngelNetw0rk/win-server-manager"
$installPath = "C:\WinServerManager"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Win Server Manager - Auto Installer" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$promptStr = ru "Q2hvb3NlIGxhbmd1YWdlIC8g0JLRi9Cx0LXRgNC40YLQtSDRj9C30YvQuiBbMSAtIEVOLCAyIC0gUlVdOiA="
$langChoice = Read-Host $promptStr
$lang = if ($langChoice -eq '2') { 'RU' } else { 'EN' }

# 1. Check Directory
if (Test-Path $installPath) {
    if ($lang -eq 'RU') {
        $warnPath = (ru "W1dBUk5dINCf0LDQv9C60LAgezB9INGD0LbQtSDRgdGD0YnQtdGB0YLQstGD0LXRgiE=") -f $installPath
        Write-Host $warnPath -ForegroundColor Yellow
        $ans = Read-Host (ru "0KPQtNCw0LvQuNGC0Ywg0Lgg0YPRgdGC0LDQvdC+0LLQuNGC0Ywg0LfQsNC90L7QstC+PyAoeS9OKTog")
    } else {
        Write-Host "[WARN] Directory $installPath already exists!" -ForegroundColor Yellow
        $ans = Read-Host "Delete and reinstall? (y/N)"
    }
    
    if ($ans -eq 'y') {
        Remove-Item -Path $installPath -Recurse -Force
    } else {
        if ($lang -eq 'RU') { Write-Host (ru "0KPRgdGC0LDQvdC+0LLQutCwINC+0YLQvNC10L3QtdC90LAu") -ForegroundColor Red }
        else { Write-Host "Installation cancelled." -ForegroundColor Red }
        exit
    }
}

if ($lang -eq 'RU') { Write-Host ((ru "WzEvNV0g0J/QvtC00LPQvtGC0L7QstC60LAg0L/QsNC/0LrQuCB7MH0uLi4=") -f $installPath) -ForegroundColor Cyan }
else { Write-Host "[1/5] Preparing directory $installPath..." -ForegroundColor Cyan }

New-Item -ItemType Directory -Force -Path $installPath | Out-Null

# 2. Download from GitHub
$zipUrl = "$repoUrl/archive/refs/heads/main.zip"
$zipPath = "$env:TEMP\win_server_manager.zip"

if ($lang -eq 'RU') { Write-Host (ru "WzIvNV0g0KHQutCw0YfQuNCy0LDQvdC40LUg0YEgR2l0SHViLi4u") -ForegroundColor Cyan }
else { Write-Host "[2/5] Downloading from GitHub ($zipUrl)..." -ForegroundColor Cyan }

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
} catch {
    if ($lang -eq 'RU') { Write-Host (ru "W0VSUk9SXSDQndC1INGD0LTQsNC70L7RgdGMINGB0LrQsNGH0LDRgtGMLiDQn9GA0L7QstC10YDRjNGC0LUg0YHRgdGL0LvQutGD0IQ=") -ForegroundColor Red }
    else { Write-Host "[ERROR] Download failed. Check the URL!" -ForegroundColor Red }
    exit
}

# 3. Extracting
if ($lang -eq 'RU') { Write-Host (ru "WzMvNV0g0KDQsNGB0L/QsNC60L7QstC60LAg0LDRgNGF0LjQstCwLi4u") -ForegroundColor Cyan }
else { Write-Host "[3/5] Extracting archive..." -ForegroundColor Cyan }

Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\wsm_extract" -Force
$extractedFolder = Get-ChildItem -Path "$env:TEMP\wsm_extract" | Select-Object -First 1
Move-Item -Path "$($extractedFolder.FullName)\*" -Destination $installPath -Force

Remove-Item -Path $zipPath -Force
Remove-Item -Path "$env:TEMP\wsm_extract" -Recurse -Force

# 4. Install dependencies (npm install)
if ($lang -eq 'RU') { Write-Host "[4/5] Установка зависимостей (npm install)..." -ForegroundColor Cyan }
else { Write-Host "[4/5] Installing dependencies (npm install)..." -ForegroundColor Cyan }

Set-Location $installPath

# CRITICAL FIX: GitHub ZIPs convert CRLF to LF, which breaks cmd.exe parsing.
$batContent = Get-Content "manager.bat" -Raw
$batContent = $batContent -replace "(?<!\r)\n", "`r`n"
Set-Content -Path "manager.bat" -Value $batContent -Force

New-Item -ItemType Directory -Force -Path "data" | Out-Null

# Save language and setup_complete flag to security.json
$securityData = @{
    lang = $lang
    strict_mode = $false
    setup_complete = $false
} | ConvertTo-Json
Set-Content -Path "data\security.json" -Value $securityData -Encoding UTF8 -Force

# Run npm install
try {
    & npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw "npm install exited with code $LASTEXITCODE" }
    if ($lang -eq 'RU') { Write-Host "[OK] Зависимости установлены." -ForegroundColor Green }
    else { Write-Host "[OK] Dependencies installed." -ForegroundColor Green }
} catch {
    if ($lang -eq 'RU') { Write-Host "[ERROR] npm install завершился с ошибкой: $_" -ForegroundColor Red }
    else { Write-Host "[ERROR] npm install failed: $_" -ForegroundColor Red }
    Write-Host "" -ForegroundColor Yellow
    if ($lang -eq 'RU') { Write-Host "Попробуйте запустить manager.bat вручную - установка продолжится автоматически." -ForegroundColor Yellow }
    else { Write-Host "Try running manager.bat manually - installation will continue automatically." -ForegroundColor Yellow }
}

# 5. Start manager.bat (will auto-detect setup_complete=false and run Setup Wizard)
if ($lang -eq 'RU') { Write-Host "[5/5] Запуск Мастера Настройки..." -ForegroundColor Cyan }
else { Write-Host "[5/5] Starting Setup Wizard..." -ForegroundColor Cyan }

Start-Process cmd.exe -ArgumentList "/k manager.bat" -WorkingDirectory $installPath

Write-Host "=============================================" -ForegroundColor Green
if ($lang -eq 'RU') {
    Write-Host (ru "INCj0KHQotCQ0J3QntCS0JrQkCDQl9CQ0JLQldCg0KjQldCd0CE=") -ForegroundColor Green
    Write-Host ((ru "INCf0YDQvtC10LrRgiDQvdCw0YXQvtC00LjRgtGB0Y8g0LI6IHswfQ==") -f $installPath) -ForegroundColor White
    Write-Host (ru "INCX0LDQutGA0L7QudGC0LUg0Y3RgtC+INC+0LrQvdC+INC40LvQuCDQt9Cw0L/Rg9GB0YLQuNGC0LUgbWFuYWdlci5iYXQg0LLRgNGD0YfQvdGD0Y4u") -ForegroundColor White
} else {
    Write-Host " INSTALLATION COMPLETE!" -ForegroundColor Green
    Write-Host " Project is now located at: $installPath" -ForegroundColor White
    Write-Host " Close this window or run manager.bat manually." -ForegroundColor White
}
Write-Host "=============================================" -ForegroundColor Green
