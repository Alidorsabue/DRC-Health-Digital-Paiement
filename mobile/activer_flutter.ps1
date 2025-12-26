# Script pour activer Flutter dans la session PowerShell actuelle

Write-Host "=== Activation de Flutter dans cette session ===" -ForegroundColor Cyan
Write-Host ""

$flutterPath = "C:\Program Files\flutter\bin"

# Verifier que Flutter existe
if (-not (Test-Path "$flutterPath\flutter.bat")) {
    Write-Host "ERREUR: Flutter non trouve a : $flutterPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez que Flutter est installe a cet emplacement" -ForegroundColor Yellow
    pause
    exit 1
}

# Ajouter Flutter au PATH de cette session
if ($env:Path -notlike "*$flutterPath*") {
    $env:Path = "$flutterPath;$env:Path"
    Write-Host "Flutter ajoute au PATH de cette session" -ForegroundColor Green
} else {
    Write-Host "Flutter est deja dans le PATH de cette session" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test de Flutter..." -ForegroundColor Yellow
flutter --version

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Flutter fonctionne correctement ! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Vous pouvez maintenant utiliser :" -ForegroundColor Cyan
    Write-Host "   flutter pub get" -ForegroundColor White
    Write-Host "   flutter run" -ForegroundColor White
    Write-Host "   flutter doctor" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERREUR: Flutter ne fonctionne pas" -ForegroundColor Red
    Write-Host ""
    Write-Host "Essayez de redemarrer PowerShell" -ForegroundColor Yellow
}

Write-Host ""

