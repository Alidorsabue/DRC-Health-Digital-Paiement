# Script PowerShell pour construire l'APK Flutter
# Ce script construit l'APK release de l'application mobile

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Build APK - DRC Digit Payment" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Flutter est installé
Write-Host "Vérification de Flutter..." -ForegroundColor Yellow
$flutterVersion = flutter --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Flutter n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    Write-Host "Veuillez installer Flutter depuis https://flutter.dev/docs/get-started/install" -ForegroundColor Red
    exit 1
}
Write-Host "Flutter détecté ✓" -ForegroundColor Green
Write-Host ""

# Aller dans le dossier mobile
Set-Location mobile

# Nettoyer les builds précédents
Write-Host "Nettoyage des builds précédents..." -ForegroundColor Yellow
flutter clean
Write-Host "Nettoyage terminé ✓" -ForegroundColor Green
Write-Host ""

# Récupérer les dépendances
Write-Host "Récupération des dépendances..." -ForegroundColor Yellow
flutter pub get
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Échec de la récupération des dépendances" -ForegroundColor Red
    exit 1
}
Write-Host "Dépendances récupérées ✓" -ForegroundColor Green
Write-Host ""

# Vérifier que les licences Android sont acceptées
Write-Host "Vérification des licences Android..." -ForegroundColor Yellow
flutter doctor --android-licenses
Write-Host ""

# Construire l'APK release
Write-Host "Construction de l'APK release..." -ForegroundColor Yellow
Write-Host "Cela peut prendre plusieurs minutes..." -ForegroundColor Yellow
flutter build apk --release

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Échec de la construction de l'APK" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Build réussi! ✓" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "APK généré dans: mobile\build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour installer sur un appareil Android:" -ForegroundColor Yellow
Write-Host "  adb install mobile\build\app\outputs\flutter-apk\app-release.apk" -ForegroundColor White
Write-Host ""

# Retourner au dossier racine
Set-Location ..

