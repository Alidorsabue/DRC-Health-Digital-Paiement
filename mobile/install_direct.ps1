# Script d'installation utilisant le chemin direct vers Flutter

Write-Host "=== Installation des dependances Flutter (chemin direct) ===" -ForegroundColor Cyan
Write-Host ""

$flutterBin = "C:\Program Files\flutter\bin"
$flutterBat = "$flutterBin\flutter.bat"

# Verifier que Flutter existe
if (-not (Test-Path $flutterBat)) {
    Write-Host "ERREUR: Flutter non trouve a : $flutterBat" -ForegroundColor Red
    Write-Host "Verifiez le chemin dans ce script" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "Flutter trouve : $flutterBin" -ForegroundColor Green
Write-Host ""

# Tester Flutter
Write-Host "Verification de la version..." -ForegroundColor Yellow
try {
    Push-Location $flutterBin
    $version = cmd /c "flutter.bat --version" 2>&1 | Select-Object -First 1
    Pop-Location
    Write-Host "Version : $version" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Impossible d'executer Flutter" -ForegroundColor Red
    Write-Host "Erreur : $_" -ForegroundColor Red
    pause
    exit 1
}

# Aller dans le repertoire mobile
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Nettoyer le projet
Write-Host ""
Write-Host "Nettoyage du projet..." -ForegroundColor Yellow
Push-Location $flutterBin
$cleanResult = cmd /c "flutter.bat clean" 2>&1
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "Avertissement lors du nettoyage (peut etre ignore)" -ForegroundColor Yellow
}

# Obtenir les dependances
Write-Host ""
Write-Host "Installation des dependances..." -ForegroundColor Yellow
Push-Location $flutterBin
$pubGetResult = cmd /c "flutter.bat pub get" 2>&1
$pubGetExitCode = $LASTEXITCODE
Pop-Location

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
    Write-Host "2. Lancez l'application avec :" -ForegroundColor White
    Write-Host "   cmd /c `"`"$flutterBat`" run`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "OU configurez Flutter dans le PATH pour utiliser 'flutter' directement :" -ForegroundColor Yellow
    Write-Host "   .\fix_flutter_path.ps1" -ForegroundColor Cyan
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
    Write-Host "   cmd /c `"`"$flutterBat`" clean`"" -ForegroundColor Cyan
    Write-Host "   cmd /c `"`"$flutterBat`" pub get`"" -ForegroundColor Cyan
    Write-Host ""
}

pause

