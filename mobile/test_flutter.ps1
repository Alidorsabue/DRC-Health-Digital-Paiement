# Script de test rapide pour Flutter

Write-Host "=== Test Flutter ===" -ForegroundColor Cyan
Write-Host ""

$flutterPath = "C:\Program Files\flutter\bin\flutter.bat"

if (Test-Path $flutterPath) {
    Write-Host "OK Flutter trouve a : $flutterPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test de la version..." -ForegroundColor Yellow
    
    try {
        $version = & $flutterPath --version 2>&1 | Select-Object -First 3
        Write-Host ""
        Write-Host "Version Flutter :" -ForegroundColor Green
        $version | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
        Write-Host ""
        Write-Host "Flutter fonctionne correctement !" -ForegroundColor Green
    } catch {
        Write-Host "ERREUR: Impossible d'executer Flutter" -ForegroundColor Red
        Write-Host "Erreur : $_" -ForegroundColor Red
    }
} else {
    Write-Host "ERREUR: Flutter non trouve a : $flutterPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez que le chemin est correct" -ForegroundColor Yellow
}

Write-Host ""
pause

