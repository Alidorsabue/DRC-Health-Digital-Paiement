# Script pour verifier l'etat du projet Flutter

Write-Host "=== Verification du projet Flutter ===" -ForegroundColor Cyan
Write-Host ""

# Verifier les dossiers essentiels
Write-Host "1. Verification des dossiers..." -ForegroundColor Yellow

$androidExists = Test-Path "android"
$iosExists = Test-Path "ios"
$libExists = Test-Path "lib"
$pubspecExists = Test-Path "pubspec.yaml"

if ($androidExists) {
    Write-Host "   OK Dossier android/ existe" -ForegroundColor Green
} else {
    Write-Host "   ERREUR Dossier android/ manquant" -ForegroundColor Red
    Write-Host "   Executez : .\flutter.ps1 create ." -ForegroundColor Yellow
}

if ($iosExists) {
    Write-Host "   OK Dossier ios/ existe" -ForegroundColor Green
} else {
    Write-Host "   INFO Dossier ios/ n'existe pas (normal sur Windows)" -ForegroundColor Yellow
}

if ($libExists) {
    Write-Host "   OK Dossier lib/ existe" -ForegroundColor Green
} else {
    Write-Host "   ERREUR Dossier lib/ manquant" -ForegroundColor Red
}

if ($pubspecExists) {
    Write-Host "   OK Fichier pubspec.yaml existe" -ForegroundColor Green
} else {
    Write-Host "   ERREUR Fichier pubspec.yaml manquant" -ForegroundColor Red
}

# Verifier Flutter
Write-Host ""
Write-Host "2. Verification de Flutter..." -ForegroundColor Yellow
$flutterBin = "C:\Program Files\flutter\bin"
if (Test-Path "$flutterBin\flutter.bat") {
    Write-Host "   OK Flutter trouve" -ForegroundColor Green
} else {
    Write-Host "   ERREUR Flutter non trouve" -ForegroundColor Red
}

# Verifier les dependances
Write-Host ""
Write-Host "3. Verification des dependances..." -ForegroundColor Yellow
if (Test-Path "pubspec.lock") {
    Write-Host "   OK Dependances installees (pubspec.lock existe)" -ForegroundColor Green
} else {
    Write-Host "   ATTENTION Dependances non installees" -ForegroundColor Yellow
    Write-Host "   Executez : .\flutter.ps1 pub get" -ForegroundColor Yellow
}

# Resume
Write-Host ""
Write-Host "=== Resume ===" -ForegroundColor Cyan

if ($androidExists -and $libExists -and $pubspecExists) {
    Write-Host "Le projet est pret pour Android Studio !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour lancer l'application :" -ForegroundColor Cyan
    Write-Host "   .\run_app.ps1" -ForegroundColor White
    Write-Host "   OU" -ForegroundColor Gray
    Write-Host "   .\flutter.ps1 run" -ForegroundColor White
} else {
    Write-Host "Le projet n'est pas completement initialise" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Actions necessaires :" -ForegroundColor Cyan
    if (-not $androidExists) {
        Write-Host "   - Creer les fichiers Android : .\flutter.ps1 create ." -ForegroundColor White
    }
    if (-not (Test-Path "pubspec.lock")) {
        Write-Host "   - Installer les dependances : .\flutter.ps1 pub get" -ForegroundColor White
    }
}

Write-Host ""

