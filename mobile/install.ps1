# Script d'installation pour l'application Flutter DRC Digit Payment

Write-Host "=== Installation des dependances Flutter ===" -ForegroundColor Cyan

# Verifier si Flutter est installe
Write-Host "Verification de Flutter..." -ForegroundColor Yellow

# Essayer de trouver Flutter dans le PATH
$flutterPath = Get-Command flutter -ErrorAction SilentlyContinue

if (-not $flutterPath) {
    Write-Host ""
    Write-Host "ERREUR: Flutter n'est pas trouve dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Consultez INSTALL_FLUTTER.md pour les instructions completes" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Resume rapide :" -ForegroundColor Yellow
    Write-Host "1. Telechargez Flutter depuis : https://flutter.dev/docs/get-started/install/windows" -ForegroundColor White
    Write-Host "2. Extrayez dans C:\src\flutter" -ForegroundColor White
    Write-Host "3. Ajoutez C:\src\flutter\bin au PATH systeme" -ForegroundColor White
    Write-Host "4. Redemarrez PowerShell" -ForegroundColor White
    Write-Host ""
    
    # Verifier les emplacements communs de Flutter
    $commonPaths = @(
        "$env:LOCALAPPDATA\flutter\bin",
        "$env:ProgramFiles\flutter\bin",
        "C:\Program Files\flutter\bin",
        "C:\src\flutter\bin",
        "C:\flutter\bin"
    )
    
    $foundFlutter = $false
    foreach ($path in $commonPaths) {
        if (Test-Path "$path\flutter.bat") {
            Write-Host "Flutter trouve a : $path" -ForegroundColor Green
            Write-Host "Ajoutez ce chemin au PATH pour continuer" -ForegroundColor Yellow
            $foundFlutter = $true
        }
    }
    
    if (-not $foundFlutter) {
        Write-Host "Flutter n'a pas ete trouve dans les emplacements communs" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Apres avoir installe/configure Flutter, relancez ce script" -ForegroundColor Cyan
    pause
    exit 1
}

# Verifier la version de Flutter et valider l'installation
Write-Host "Flutter trouve : $($flutterPath.Source)" -ForegroundColor Green

# Verifier si c'est un vrai Flutter (pas un alias ou un faux)
if ($flutterPath.Source -like "*system32*" -or $flutterPath.Source -notlike "*flutter\bin*") {
    Write-Host ""
    Write-Host "ATTENTION: Le chemin trouve semble suspect !" -ForegroundColor Yellow
    Write-Host "Le vrai Flutter devrait etre dans un dossier comme C:\src\flutter\bin" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Verification de la version..." -ForegroundColor Yellow
    $versionOutput = flutter --version 2>&1
    if ($LASTEXITCODE -ne 0 -or $versionOutput -match "Impossible|erreur|error") {
        Write-Host ""
        Write-Host "ERREUR: Flutter n'est pas correctement installe" -ForegroundColor Red
        Write-Host "Le fichier trouve n'est pas le vrai SDK Flutter" -ForegroundColor Red
        Write-Host ""
        Write-Host "Consultez INSTALL_FLUTTER.md pour les instructions completes" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Resume rapide :" -ForegroundColor Yellow
        Write-Host "1. Telechargez depuis : https://flutter.dev/docs/get-started/install/windows" -ForegroundColor White
        Write-Host "2. Extrayez dans C:\src\flutter" -ForegroundColor White
        Write-Host "3. Ajoutez C:\src\flutter\bin au PATH systeme" -ForegroundColor White
        Write-Host "4. Redemarrez PowerShell" -ForegroundColor White
        Write-Host ""
        Write-Host "OU executez le script de diagnostic :" -ForegroundColor Cyan
        Write-Host "   .\check_flutter.ps1" -ForegroundColor Cyan
        Write-Host ""
        pause
        exit 1
    }
}

Write-Host "Verification de la version..." -ForegroundColor Yellow
$versionOutput = flutter --version 2>&1
if ($LASTEXITCODE -eq 0) {
    $firstLine = $versionOutput | Select-Object -First 1
    Write-Host "Version : $firstLine" -ForegroundColor Green
} else {
    Write-Host "ERREUR: Impossible d'obtenir la version de Flutter" -ForegroundColor Red
    Write-Host "Sortie : $versionOutput" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Flutter n'est pas correctement installe. Suivez les instructions ci-dessus." -ForegroundColor Yellow
    pause
    exit 1
}

# Aller dans le répertoire mobile
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Nettoyer le projet
Write-Host ""
Write-Host "Nettoyage du projet..." -ForegroundColor Yellow
$cleanResult = flutter clean 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Avertissement lors du nettoyage (peut etre ignore)" -ForegroundColor Yellow
    Write-Host "Sortie : $cleanResult" -ForegroundColor Gray
}

# Obtenir les dependances
Write-Host ""
Write-Host "Installation des dependances..." -ForegroundColor Yellow
$pubGetResult = flutter pub get 2>&1
$pubGetExitCode = $LASTEXITCODE

# Afficher la sortie complete
Write-Host ""
Write-Host "--- Sortie de flutter pub get ---" -ForegroundColor Gray
Write-Host $pubGetResult

if ($pubGetExitCode -eq 0) {
    Write-Host ""
    Write-Host "=== Installation terminee avec succes ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines etapes :" -ForegroundColor Cyan
    Write-Host "1. Configurez l'URL de l'API dans les parametres de l'application" -ForegroundColor White
    Write-Host "2. Lancez l'application avec : flutter run" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "=== Erreur lors de l'installation ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Code de sortie : $pubGetExitCode" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Solutions possibles :" -ForegroundColor Yellow
    Write-Host "1. Verifiez votre connexion internet" -ForegroundColor White
    Write-Host "2. Verifiez que le fichier pubspec.yaml est valide" -ForegroundColor White
    Write-Host "3. Essayez manuellement :" -ForegroundColor White
    Write-Host "   flutter clean" -ForegroundColor Cyan
    Write-Host "   flutter pub get" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Si le probleme persiste, verifiez Flutter :" -ForegroundColor White
    Write-Host "   flutter doctor" -ForegroundColor Cyan
    Write-Host ""
}

pause

