# Guide : Utiliser Flutter avec Android Studio

## Problème

Le projet Flutter n'a pas encore les fichiers Android nécessaires pour fonctionner avec Android Studio.

## Solution : Initialiser le projet Flutter

### Étape 1 : Installer les dépendances

Utilisez le wrapper PowerShell :

```powershell
.\flutter.ps1 pub get
```

OU avec le script direct :

```powershell
.\install_direct.ps1
```

### Étape 2 : Initialiser les fichiers Android/iOS

Le projet doit être initialisé pour créer les dossiers `android/` et `ios/` :

```powershell
.\flutter.ps1 create .
```

OU avec le chemin complet :

```powershell
cmd /c "C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin\flutter.bat create ."
```

**⚠️ Important :** Répondez **"N"** (Non) quand on vous demande de réécrire les fichiers existants, sauf si vous voulez réinitialiser complètement.

### Étape 3 : Ouvrir dans Android Studio

1. Ouvrez Android Studio
2. File → Open
3. Sélectionnez le dossier `mobile`
4. Android Studio va détecter automatiquement que c'est un projet Flutter

### Étape 4 : Configurer l'émulateur

1. Dans Android Studio : Tools → Device Manager
2. Créez un nouvel émulateur si vous n'en avez pas
3. Démarrez l'émulateur

### Étape 5 : Lancer l'application

**Option A : Depuis Android Studio**
- Cliquez sur le bouton "Run" (▶️)
- Ou appuyez sur `Shift + F10`

**Option B : Depuis la ligne de commande**

```powershell
.\flutter.ps1 run
```

OU

```powershell
cmd /c "C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin\flutter.bat run"
```

## Vérification

Avant de lancer, vérifiez que tout est OK :

```powershell
.\flutter.ps1 doctor
```

Assurez-vous que :
- ✅ Flutter SDK est détecté
- ✅ Android toolchain est configuré
- ✅ Un appareil/émulateur est connecté

## Problèmes courants

### "No devices found"
- Démarrez un émulateur Android depuis Android Studio
- OU connectez un appareil physique avec USB debugging activé

### "Android SDK not found"
- Ouvrez Android Studio
- File → Settings → Appearance & Behavior → System Settings → Android SDK
- Installez les SDK nécessaires

### Erreurs de compilation
- Nettoyez le projet : `.\flutter.ps1 clean`
- Réinstallez les dépendances : `.\flutter.ps1 pub get`
- Rebuild : `.\flutter.ps1 build apk`

## Commandes utiles

```powershell
# Vérifier l'état
.\flutter.ps1 doctor

# Nettoyer
.\flutter.ps1 clean

# Installer dépendances
.\flutter.ps1 pub get

# Lancer sur émulateur/appareil
.\flutter.ps1 run

# Build APK
.\flutter.ps1 build apk
```


















