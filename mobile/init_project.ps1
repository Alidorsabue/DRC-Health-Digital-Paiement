# Script pour initialiser le projet Flutter avec les fichiers Android/iOS

Write-Host "=== Initialisation du projet Flutter ===" -ForegroundColor Cyan
Write-Host ""

$flutterBin = "C:\Program Files\flutter\bin"
$flutterBat = "$flutterBin\flutter.bat"

# Verifier que Flutter existe
if (-not (Test-Path $flutterBat)) {
    Write-Host "ERREUR: Flutter non trouve a : $flutterBat" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Flutter trouve : $flutterBin" -ForegroundColor Green
Write-Host ""

# Aller dans le repertoire mobile
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Verifier si android/ existe deja
if (Test-Path "android") {
    Write-Host "Le dossier android existe deja" -ForegroundColor Yellow
    Write-Host "Voulez-vous le recreer ? (O/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "O" -and $response -ne "o") {
        Write-Host "Annule" -ForegroundColor Yellow
        exit 0
    }
}

# Installer les dependances d'abord
Write-Host ""
Write-Host "Installation des dependances..." -ForegroundColor Yellow
Push-Location $flutterBin
$pubGetResult = cmd /c "flutter.bat pub get" 2>&1
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de l'installation des dependances" -ForegroundColor Red
    Write-Host $pubGetResult
    pause
    exit 1
}

# Initialiser les fichiers Android/iOS
Write-Host ""
Write-Host "Initialisation des fichiers Android/iOS..." -ForegroundColor Yellow
Write-Host "Cette operation va creer les dossiers android/ et ios/" -ForegroundColor Gray
Write-Host ""

Push-Location $flutterBin
$createResult = cmd /c "flutter.bat create . --org com.drc --project-name drc_digit_payment" 2>&1
Pop-Location

Write-Host $createResult

# Verifier si les dossiers ont ete crees
Write-Host ""
Write-Host "Verification des dossiers crees..." -ForegroundColor Yellow
$androidExists = Test-Path "android"
$iosExists = Test-Path "ios"

if ($androidExists) {
    Write-Host "   OK Dossier android/ existe" -ForegroundColor Green
} else {
    Write-Host "   ERREUR Dossier android/ non trouve" -ForegroundColor Red
}

if ($iosExists) {
    Write-Host "   OK Dossier ios/ existe" -ForegroundColor Green
} else {
    Write-Host "   INFO Dossier ios/ non trouve (normal si vous n'etes pas sur Mac)" -ForegroundColor Yellow
}

if ($LASTEXITCODE -eq 0 -or $androidExists) {
    Write-Host ""
    Write-Host "=== Initialisation terminee avec succes ===" -ForegroundColor Green
    Write-Host ""
    
    if ($androidExists) {
        Write-Host "Le projet est maintenant pret pour Android Studio !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prochaines etapes :" -ForegroundColor Cyan
        Write-Host "1. Ouvrez Android Studio" -ForegroundColor White
        Write-Host "2. File -> Open -> Selectionnez le dossier mobile" -ForegroundColor White
        Write-Host "3. Demarrez un emulateur ou connectez un appareil" -ForegroundColor White
        Write-Host "4. Cliquez sur Run (ou Shift+F10)" -ForegroundColor White
        Write-Host ""
        Write-Host "OU depuis la ligne de commande :" -ForegroundColor Cyan
        Write-Host "   .\flutter.ps1 run" -ForegroundColor White
        Write-Host "   OU" -ForegroundColor Gray
        Write-Host "   .\run_app.ps1" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "ATTENTION: Les dossiers Android/iOS n'ont pas ete crees" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Essayez manuellement :" -ForegroundColor Cyan
        Write-Host "   .\flutter.ps1 create ." -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "ATTENTION: Il y a eu des erreurs lors de l'initialisation" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Essayez manuellement :" -ForegroundColor Cyan
    Write-Host "   .\flutter.ps1 create ." -ForegroundColor White
    Write-Host ""
    Write-Host "Ou consultez GUIDE_ANDROID_STUDIO.md pour plus d'aide" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Appuyez sur Entree pour continuer..." -ForegroundColor Gray
$null = Read-Host

