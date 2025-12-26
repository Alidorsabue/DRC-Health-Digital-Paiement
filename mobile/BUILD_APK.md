# Guide de Build APK - DRC Digit Payment

Ce guide explique comment construire l'APK de l'application mobile Flutter.

## 📋 Prérequis

1. **Flutter SDK** installé (version 3.0+)
   - Télécharger depuis: https://flutter.dev/docs/get-started/install
   - Vérifier l'installation: `flutter doctor`

2. **Android Studio** installé avec:
   - Android SDK
   - Android SDK Platform-Tools
   - Licences Android acceptées

3. **Java JDK 17** installé

## 🚀 Build APK (Windows PowerShell)

### Méthode 1: Script automatique

```powershell
.\mobile\build-apk.ps1
```

Le script va automatiquement:
- Vérifier que Flutter est installé
- Nettoyer les builds précédents
- Récupérer les dépendances
- Construire l'APK release

L'APK sera généré dans: `mobile\build\app\outputs\flutter-apk\app-release.apk`

### Méthode 2: Commandes manuelles

```powershell
# Aller dans le dossier mobile
cd mobile

# Nettoyer les builds précédents
flutter clean

# Récupérer les dépendances
flutter pub get

# Construire l'APK release
flutter build apk --release
```

## 🐧 Build APK (Linux/macOS)

### Méthode 1: Script automatique

```bash
chmod +x mobile/build-apk.sh
./mobile/build-apk.sh
```

### Méthode 2: Commandes manuelles

```bash
cd mobile
flutter clean
flutter pub get
flutter build apk --release
```

## 📦 Résultat

L'APK sera généré dans:
- **Windows**: `mobile\build\app\outputs\flutter-apk\app-release.apk`
- **Linux/macOS**: `mobile/build/app/outputs/flutter-apk/app-release.apk`

## 📱 Installation sur un appareil Android

### Méthode 1: Via ADB (Android Debug Bridge)

```bash
# Windows
adb install mobile\build\app\outputs\flutter-apk\app-release.apk

# Linux/macOS
adb install mobile/build/app/outputs/flutter-apk/app-release.apk
```

### Méthode 2: Transfert manuel

1. Copiez l'APK sur votre appareil Android (via USB, email, cloud, etc.)
2. Sur l'appareil, ouvrez le fichier APK
3. Autorisez l'installation depuis des sources inconnues si nécessaire
4. Installez l'application

## 🔧 Options de build supplémentaires

### Build APK avec split par ABI (taille réduite)

```bash
flutter build apk --split-per-abi
```

Cela génère des APK séparés pour chaque architecture:
- `app-armeabi-v7a-release.apk` (32-bit ARM)
- `app-arm64-v8a-release.apk` (64-bit ARM)
- `app-x86_64-release.apk` (64-bit x86)

### Build App Bundle (pour Google Play Store)

```bash
flutter build appbundle
```

Génère un fichier `.aab` dans: `build/app/outputs/bundle/release/app-release.aab`

### Build avec signature personnalisée

1. Créez un fichier `android/key.properties`:
```properties
storePassword=votre_mot_de_passe
keyPassword=votre_mot_de_passe
keyAlias=votre_alias
storeFile=chemin/vers/votre/keystore.jks
```

2. Modifiez `android/app/build.gradle.kts` pour utiliser la signature (voir documentation Flutter)

3. Construisez l'APK:
```bash
flutter build apk --release
```

## ⚙️ Configuration de l'URL de l'API

Avant de construire l'APK, assurez-vous que l'URL de l'API est correctement configurée:

1. **Modifier le fichier de configuration**:
   - Ouvrez `mobile/lib/config/app_config.dart`
   - Modifiez `defaultApiUrl` avec l'URL de votre backend Railway:
   ```dart
   static const String defaultApiUrl = 'https://votre-backend.up.railway.app';
   ```

2. **Ou configurer via les préférences**:
   - L'utilisateur peut configurer l'URL après l'installation via les paramètres de l'application

## 🐛 Dépannage

### Erreur: "Flutter command not found"

- Vérifiez que Flutter est dans votre PATH
- Redémarrez votre terminal
- Vérifiez avec: `flutter doctor`

### Erreur: "Android licenses not accepted"

```bash
flutter doctor --android-licenses
```

Acceptez toutes les licences en tapant `y`.

### Erreur: "Gradle build failed"

- Vérifiez que Java JDK 17 est installé
- Vérifiez que Android SDK est correctement configuré
- Nettoyez le projet: `flutter clean`
- Supprimez le dossier `mobile/android/.gradle` et réessayez

### Erreur: "SDK location not found"

- Configurez la variable d'environnement `ANDROID_HOME`:
  - Windows: `setx ANDROID_HOME "C:\Users\VotreNom\AppData\Local\Android\Sdk"`
  - Linux/macOS: `export ANDROID_HOME=$HOME/Android/Sdk`

### L'APK est trop volumineux

- Utilisez `flutter build apk --split-per-abi` pour générer des APK séparés par architecture
- Utilisez `flutter build appbundle` pour Google Play Store (meilleure compression)

## 📚 Ressources

- Documentation Flutter: https://flutter.dev/docs/deployment/android
- Guide de signature Android: https://flutter.dev/docs/deployment/android#signing-the-app
- Railway Deployment: Voir `RAILWAY_DEPLOYMENT.md` à la racine du projet

