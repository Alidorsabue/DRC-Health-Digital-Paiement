# Guide d'installation de Flutter

## 🚨 Problème détecté

Flutter n'est pas correctement installé sur votre système. Un fichier nommé "flutter" existe dans `C:\WINDOWS\system32`, mais ce n'est **PAS** le vrai SDK Flutter.

## ✅ Solution : Installation correcte de Flutter

### Étape 1 : Télécharger Flutter

1. Allez sur : https://flutter.dev/docs/get-started/install/windows
2. Cliquez sur "Download Flutter SDK"
3. Téléchargez le fichier ZIP (environ 1.5 GB)

### Étape 2 : Extraire Flutter

1. Créez le dossier `C:\src` s'il n'existe pas
2. Extrayez le contenu du ZIP dans `C:\src\flutter`
3. Vous devriez avoir : `C:\src\flutter\bin\flutter.bat`

**⚠️ Important :**
- Ne pas extraire dans `C:\Program Files` (espaces dans le chemin)
- Ne pas extraire dans `C:\Windows\system32`
- Utilisez `C:\src\flutter` ou `C:\flutter`

### Étape 3 : Ajouter Flutter au PATH

1. Appuyez sur `Win + X` puis `Y` (ouvre PowerShell en admin)
   - OU tapez `sysdm.cpl` dans `Win + R` puis Entrée

2. Allez dans l'onglet **"Avancé"**

3. Cliquez sur **"Variables d'environnement"**

4. Dans **"Variables système"**, trouvez **"Path"** et cliquez sur **"Modifier"**

5. Cliquez sur **"Nouveau"** et ajoutez :
   ```
   C:\src\flutter\bin
   ```

6. Cliquez sur **"OK"** pour fermer toutes les fenêtres

### Étape 4 : Redémarrer PowerShell

1. **Fermez complètement** PowerShell/CMD
2. Rouvrez PowerShell dans le dossier `mobile`
3. Vérifiez l'installation :
   ```powershell
   flutter --version
   ```

Vous devriez voir quelque chose comme :
```
Flutter 3.x.x • channel stable • ...
```

### Étape 5 : Vérifier l'installation complète

```powershell
flutter doctor
```

Cette commande vérifie tous les composants nécessaires.

## ✅ Après l'installation

Une fois Flutter installé, exécutez :

```powershell
.\install.ps1
```

## 🆘 Problèmes courants

### "flutter: command not found"
- Flutter n'est pas dans le PATH
- Redémarrez PowerShell après avoir modifié le PATH
- Vérifiez que le chemin est correct : `C:\src\flutter\bin`

### "SDK location not found"
- Flutter n'est pas correctement extrait
- Vérifiez que `C:\src\flutter\bin\flutter.bat` existe

### Erreurs de permissions
- Exécutez PowerShell en tant qu'administrateur
- Ou installez Flutter dans un dossier accessible (ex: `C:\src\flutter`)

## 📝 Vérification rapide

Exécutez ce script pour vérifier votre installation :
```powershell
.\check_flutter.ps1
```

