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

# 1. Сheck Directory
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

if ($lang -eq 'RU') { Write-Host ((ru "WzEvNF0g0J/QvtC00LPQvtGC0L7QstC60LAg0L/QsNC/0LrQuCB7MH0uLi4=") -f $installPath) -ForegroundColor Cyan }
else { Write-Host "[1/4] Preparing directory $installPath..." -ForegroundColor Cyan }

New-Item -ItemType Directory -Force -Path $installPath | Out-Null

# 2. Download from GitHub
$zipUrl = "$repoUrl/archive/refs/heads/main.zip"
$zipPath = "$env:TEMP\win_server_manager.zip"

if ($lang -eq 'RU') { Write-Host (ru "WzIvNF0g0KHQutCw0YfQuNCy0LDQvdC40LUg0YEgR2l0SHViLi4u") -ForegroundColor Cyan }
else { Write-Host "[2/4] Downloading from GitHub ($zipUrl)..." -ForegroundColor Cyan }

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath
} catch {
    if ($lang -eq 'RU') { Write-Host (ru "W0VSUk9SXSDQndC1INGD0LTQsNC70L7RgdGMINGB0LrQsNGH0LDRgtGMLiDQn9GA0L7QstC10YDRjNGC0LUg0YHRgdGL0LvQutGD0IQ=") -ForegroundColor Red }
    else { Write-Host "[ERROR] Download failed. Check the URL!" -ForegroundColor Red }
    exit
}

# 3. Extracting
if ($lang -eq 'RU') { Write-Host (ru "WzMvNF0g0KDQsNGB0L/QsNC60L7QstC60LAg0LDRgNGF0LjQstCwLi4u") -ForegroundColor Cyan }
else { Write-Host "[3/4] Extracting archive..." -ForegroundColor Cyan }

Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\wsm_extract" -Force
$extractedFolder = Get-ChildItem -Path "$env:TEMP\wsm_extract" | Select-Object -First 1
Move-Item -Path "$($extractedFolder.FullName)\*" -Destination $installPath -Force

Remove-Item -Path $zipPath -Force
Remove-Item -Path "$env:TEMP\wsm_extract" -Recurse -Force

# 4. Start manager.bat
if ($lang -eq 'RU') { Write-Host (ru "WzQvNF0g0JfQsNC/0YPRgdC6INGD0YHRgtCw0L3QvtCy0LrQuCDQt9Cw0LLQuNGB0LjQvNC+0YHRgtC10LkuLi4=") -ForegroundColor Cyan }
else { Write-Host "[4/4] Starting dependency installation..." -ForegroundColor Cyan }

Set-Location $installPath

# CRITICAL FIX: GitHub ZIPs convert CRLF to LF, which breaks cmd.exe parsing.
$batContent = Get-Content "manager.bat" -Raw
$batContent = $batContent -replace "(?<!\r)\n", "`r`n"
Set-Content -Path "manager.bat" -Value $batContent -Force

New-Item -ItemType Directory -Force -Path "data" | Out-Null
Set-Content -Path "data\lang.txt" -Value $lang -Encoding UTF8 -Force

cmd.exe /c "manager.bat"

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
