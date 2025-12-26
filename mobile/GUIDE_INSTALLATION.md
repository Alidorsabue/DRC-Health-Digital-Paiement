# Guide d'installation rapide

## 🚨 Erreur : "Flutter n'est pas installé ou n'est pas dans le PATH"

### Étape 1 : Vérifier si Flutter est installé

Exécutez dans PowerShell :
```powershell
.\check_flutter.ps1
```

Ce script va :
- ✅ Vérifier si Flutter est dans le PATH
- ✅ Chercher Flutter dans les emplacements communs
- ✅ Vous donner des instructions précises

### Étape 2 : Installer Flutter (si nécessaire)

#### Option A : Installation rapide (Recommandé)

1. **Téléchargez Flutter**
   - Allez sur : https://flutter.dev/docs/get-started/install/windows
   - Cliquez sur "Download Flutter SDK"
   - Téléchargez le fichier ZIP

2. **Extrayez Flutter**
   - Créez le dossier `C:\src` (s'il n'existe pas)
   - Extrayez le contenu du ZIP dans `C:\src\flutter`
   - Vous devriez avoir : `C:\src\flutter\bin\flutter.bat`

3. **Ajoutez au PATH**
   - Appuyez sur `Win + X` puis `Y` (ouvre PowerShell en admin)
   - Ou tapez `sysdm.cpl` dans `Win + R`
   - Allez dans "Variables d'environnement"
   - Dans "Variables système", trouvez "Path" → "Modifier"
   - Cliquez "Nouveau" → Ajoutez : `C:\src\flutter\bin`
   - Cliquez "OK" partout

4. **Redémarrez PowerShell**
   - Fermez complètement PowerShell
   - Rouvrez-le dans le dossier `mobile`

5. **Vérifiez**
   ```powershell
   flutter --version
   ```
   Vous devriez voir la version de Flutter.

#### Option B : Installation avec Git (Alternative)

Si vous avez Git installé :
```powershell
cd C:\src
git clone https://github.com/flutter/flutter.git -b stable
```

Puis ajoutez `C:\src\flutter\bin` au PATH (voir Option A, étape 3).

### Étape 3 : Installer les dépendances du projet

Une fois Flutter installé et configuré :

```powershell
.\install.ps1
```

Ou manuellement :
```powershell
flutter pub get
```

## ✅ Vérification finale

Exécutez :
```powershell
flutter doctor
```

Cette commande vérifie :
- ✅ Flutter SDK
- ✅ Android toolchain (si vous développez pour Android)
- ✅ VS Code / Android Studio (optionnel)
- ✅ Connexion internet
- ✅ Outils de développement

## 🆘 Besoin d'aide ?

- Consultez `TROUBLESHOOTING.md` pour plus de détails
- Vérifiez la documentation Flutter : https://flutter.dev/docs/get-started/install/windows
- Exécutez `.\check_flutter.ps1` pour un diagnostic automatique

## 📝 Notes importantes

- ⚠️ **Ne pas** installer Flutter dans un dossier avec des espaces (ex: `C:\Program Files\flutter`)
- ⚠️ **Redémarrer PowerShell** après avoir modifié le PATH
- ✅ Flutter fonctionne mieux dans `C:\src\flutter` ou `C:\flutter`
- ✅ Vous pouvez avoir plusieurs versions de Flutter, mais une seule dans le PATH

