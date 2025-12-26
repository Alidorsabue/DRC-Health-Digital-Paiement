# Guide d'installation - Résolution du problème "Ouvrir avec une autre application"

## 🚨 Problème

Quand vous tapez `flutter --version`, Windows demande d'ouvrir avec une autre application au lieu d'exécuter Flutter.

## ✅ Solution rapide (sans modifier le PATH)

Utilisez le script wrapper PowerShell :

```powershell
.\flutter.ps1 --version
.\flutter.ps1 pub get
.\flutter.ps1 run
```

## ✅ Solution permanente

### Étape 1 : Corriger le PATH

Exécutez :
```powershell
.\fix_flutter_path.ps1
```

### Étape 2 : Redémarrer PowerShell

**Fermez complètement PowerShell** et rouvrez-le.

### Étape 3 : Vérifier

```powershell
flutter --version
```

Vous devriez voir la version de Flutter, pas une demande d'ouvrir avec une autre application.

### Étape 4 : Installer les dépendances

```powershell
flutter pub get
```

OU utilisez le script direct :
```powershell
.\install_direct.ps1
```

## 📝 Notes importantes

- Le problème vient d'un fichier "flutter" dans `C:\WINDOWS\system32` qui n'est pas le vrai SDK
- Le vrai Flutter est à : `C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin`
- Le script `fix_flutter_path.ps1` supprime le faux et ajoute le vrai au PATH
- **Redémarrez toujours PowerShell** après avoir modifié le PATH

## 🆘 Si ça ne fonctionne toujours pas

1. Vérifiez avec : `.\check_flutter.ps1`
2. Utilisez le wrapper : `.\flutter.ps1 --version`
3. Consultez : `INSTRUCTIONS.md`


















