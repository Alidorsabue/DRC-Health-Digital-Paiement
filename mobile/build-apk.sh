#!/bin/bash
# Script bash pour construire l'APK Flutter
# Ce script construit l'APK release de l'application mobile

echo "========================================="
echo "  Build APK - DRC Digit Payment"
echo "========================================="
echo ""

# Vérifier que Flutter est installé
echo "Vérification de Flutter..."
if ! command -v flutter &> /dev/null; then
    echo "ERREUR: Flutter n'est pas installé ou n'est pas dans le PATH"
    echo "Veuillez installer Flutter depuis https://flutter.dev/docs/get-started/install"
    exit 1
fi
echo "Flutter détecté ✓"
echo ""

# Aller dans le dossier mobile
cd mobile

# Nettoyer les builds précédents
echo "Nettoyage des builds précédents..."
flutter clean
echo "Nettoyage terminé ✓"
echo ""

# Récupérer les dépendances
echo "Récupération des dépendances..."
flutter pub get
if [ $? -ne 0 ]; then
    echo "ERREUR: Échec de la récupération des dépendances"
    exit 1
fi
echo "Dépendances récupérées ✓"
echo ""

# Vérifier que les licences Android sont acceptées
echo "Vérification des licences Android..."
flutter doctor --android-licenses
echo ""

# Construire l'APK release
echo "Construction de l'APK release..."
echo "Cela peut prendre plusieurs minutes..."
flutter build apk --release

if [ $? -ne 0 ]; then
    echo "ERREUR: Échec de la construction de l'APK"
    exit 1
fi

echo ""
echo "========================================="
echo "  Build réussi! ✓"
echo "========================================="
echo ""
echo "APK généré dans: mobile/build/app/outputs/flutter-apk/app-release.apk"
echo ""
echo "Pour installer sur un appareil Android:"
echo "  adb install mobile/build/app/outputs/flutter-apk/app-release.apk"
echo ""

# Retourner au dossier racine
cd ..

