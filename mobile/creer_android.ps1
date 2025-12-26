# Script pour creer les fichiers Android manuellement

Write-Host "=== Creation des fichiers Android ===" -ForegroundColor Cyan
Write-Host ""

$flutterBin = "C:\Program Files\flutter\bin"

# Aller dans le repertoire mobile
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "Repertoire actuel : $(Get-Location)" -ForegroundColor Gray
Write-Host ""

# Essayer flutter create avec overwrite
Write-Host "Creation des fichiers Android avec Flutter..." -ForegroundColor Yellow
Push-Location $flutterBin

# Essayer d'abord sans overwrite
$result1 = cmd /c "flutter.bat create . --org com.drc --project-name drc_digit_payment --platforms android" 2>&1
Write-Host $result1

# Si ca ne marche pas, essayer avec --overwrite
if (-not (Test-Path "$scriptPath\android")) {
    Write-Host ""
    Write-Host "Tentative avec --overwrite..." -ForegroundColor Yellow
    $result2 = cmd /c "flutter.bat create . --org com.drc --project-name drc_digit_payment --platforms android --overwrite" 2>&1
    Write-Host $result2
}

Pop-Location

# Verifier le resultat
Write-Host ""
if (Test-Path "android") {
    Write-Host "=== SUCCES : Dossier android/ cree ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Le projet est maintenant pret pour Android Studio !" -ForegroundColor Green
} else {
    Write-Host "=== ERREUR : Le dossier android/ n'a pas ete cree ===" -ForegroundColor Red
    Write-Host ""
    Write-Host "Essayez manuellement dans Android Studio :" -ForegroundColor Yellow
    Write-Host "1. Ouvrez Android Studio" -ForegroundColor White
    Write-Host "2. File -> New -> New Flutter Project" -ForegroundColor White
    Write-Host "3. Selectionnez 'Flutter Application'" -ForegroundColor White
    Write-Host "4. Nom du projet : drc_digit_payment" -ForegroundColor White
    Write-Host "5. Emplacement : Selectionnez le dossier parent (pas mobile)" -ForegroundColor White
    Write-Host "6. Android Studio va creer un nouveau dossier, copiez ensuite vos fichiers lib/" -ForegroundColor White
    Write-Host ""
    Write-Host "OU utilisez directement Android Studio pour ouvrir le projet existant" -ForegroundColor Yellow
    Write-Host "Android Studio peut generer les fichiers Android automatiquement" -ForegroundColor Yellow
}

Write-Host ""
pause

