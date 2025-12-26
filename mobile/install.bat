@echo off
REM Script d'installation pour l'application Flutter DRC Digit Payment

echo === Installation des dependances Flutter ===

REM Vérifier si Flutter est installé
echo Verification de Flutter...
flutter --version >nul 2>&1
if errorlevel 1 (
    echo ERREUR: Flutter n'est pas installe ou n'est pas dans le PATH
    echo Veuillez installer Flutter depuis https://flutter.dev/docs/get-started/install/windows
    pause
    exit /b 1
)

echo Flutter est installe

REM Nettoyer le projet
echo.
echo Nettoyage du projet...
flutter clean

REM Obtenir les dépendances
echo.
echo Installation des dependances...
flutter pub get

if errorlevel 1 (
    echo.
    echo === Erreur lors de l'installation ===
    echo Verifiez les messages d'erreur ci-dessus
    pause
    exit /b 1
) else (
    echo.
    echo === Installation terminee avec succes ===
    echo Vous pouvez maintenant lancer l'application avec: flutter run
)

pause

