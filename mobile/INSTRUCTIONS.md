# Instructions pour utiliser Flutter

## Problème actuel

Windows essaie d'ouvrir `flutter` avec une autre application au lieu de l'exécuter. C'est parce qu'un fichier nommé "flutter" existe dans `C:\WINDOWS\system32` qui n'est pas le vrai SDK Flutter.

## Solution immédiate : Utiliser le wrapper PowerShell

Au lieu d'utiliser `flutter` directement, utilisez le script wrapper :

```powershell
.\flutter.ps1 --version
.\flutter.ps1 pub get
.\flutter.ps1 run
```

## Solution permanente : Corriger le PATH

### Option 1 : Script automatique

```powershell
.\fix_flutter_path.ps1
```

Puis **redémarrez PowerShell complètement**.

### Option 2 : Manuellement

1. Appuyez sur `Win + X` puis `Y` (PowerShell admin)
2. Ou tapez `sysdm.cpl` dans `Win + R`
3. Variables d'environnement → Path (utilisateur)
4. **Supprimez** `C:\WINDOWS\system32\flutter` s'il existe
5. **Ajoutez** `C:\Users\Helpdesk\Downloads\flutter_windows_3.29.3-stable\flutter\bin` au **début** de la liste
6. Redémarrez PowerShell

## Vérification

Après avoir corrigé le PATH, testez :

```powershell
flutter --version
```

Vous devriez voir la version de Flutter, pas une demande d'ouvrir avec une autre application.

## Installation des dépendances

Une fois le PATH corrigé :

```powershell
flutter pub get
```

OU utilisez le script direct :

```powershell
.\install_direct.ps1
```


















