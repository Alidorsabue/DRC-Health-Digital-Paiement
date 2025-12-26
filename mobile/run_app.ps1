# Script pour lancer l'application Flutter

Write-Host "=== Lancement de l'application Flutter ===" -ForegroundColor Cyan
Write-Host ""

$flutterBin = "C:\Program Files\flutter\bin"
$flutterBat = "$flutterBin\flutter.bat"

# Verifier que Flutter existe
if (-not (Test-Path $flutterBat)) {
    Write-Host "ERREUR: Flutter non trouve" -ForegroundColor Red
    pause
    exit 1
}

# Verifier que le projet est initialise
if (-not (Test-Path "android")) {
    Write-Host "ATTENTION: Le projet n'est pas encore initialise" -ForegroundColor Yellow
    Write-Host "Executez d'abord : .\init_project.ps1" -ForegroundColor Yellow
    pause
    exit 1
}

# Aller dans le repertoire mobile
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Verifier les appareils disponibles
Write-Host "Verification des appareils disponibles..." -ForegroundColor Yellow
Push-Location $flutterBin
$devices = cmd /c "flutter.bat devices" 2>&1
Pop-Location

Write-Host $devices
Write-Host ""

# Lancer l'application
Write-Host "Lancement de l'application..." -ForegroundColor Yellow
Write-Host ""

Push-Location $flutterBin
cmd /c "flutter.bat run"
Pop-Location

Write-Host ""
Write-Host "Application terminee" -ForegroundColor Green

