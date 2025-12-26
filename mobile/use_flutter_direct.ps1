# Script pour utiliser Flutter directement avec le chemin complet

$flutterBin = "C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin"

Write-Host "=== Utilisation de Flutter avec chemin direct ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Chemin Flutter : $flutterBin" -ForegroundColor Yellow
Write-Host ""

# Ajouter temporairement au PATH de cette session
$env:Path = "$flutterBin;$env:Path"

Write-Host "Flutter ajoute temporairement au PATH de cette session" -ForegroundColor Green
Write-Host ""
Write-Host "Vous pouvez maintenant utiliser :" -ForegroundColor Cyan
Write-Host "   flutter --version" -ForegroundColor White
Write-Host "   flutter pub get" -ForegroundColor White
Write-Host "   flutter run" -ForegroundColor White
Write-Host ""
Write-Host "Pour rendre ce changement permanent, executez :" -ForegroundColor Yellow
Write-Host "   .\fix_flutter_path.ps1" -ForegroundColor Cyan
Write-Host ""

# Tester Flutter
Write-Host "Test de Flutter..." -ForegroundColor Yellow
flutter --version

Write-Host ""
Write-Host "Si vous voyez la version de Flutter ci-dessus, tout fonctionne !" -ForegroundColor Green
Write-Host ""

