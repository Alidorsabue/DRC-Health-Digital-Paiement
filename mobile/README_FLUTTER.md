# Guide Flutter - Résolution des problèmes

## Problème : `flutter --version` ne fonctionne pas dans le dossier du projet

### Solution rapide

Exécutez ce script pour activer Flutter dans la session actuelle :

```powershell
.\activer_flutter.ps1
```

Ce script va :
- Ajouter Flutter au PATH de cette session PowerShell
- Tester que Flutter fonctionne
- Vous permettre d'utiliser `flutter` directement

### Solution permanente

Si Flutter fonctionne dans `C:\Users\Helpdesk` mais pas dans le dossier du projet, c'est probablement un problème de PATH dans cette session.

**Option 1 : Redémarrer PowerShell**
- Fermez complètement PowerShell
- Rouvrez-le dans le dossier `mobile`
- Testez : `flutter --version`

**Option 2 : Ajouter Flutter au PATH système**
1. Ouvrez les Variables d'environnement (`sysdm.cpl`)
2. Ajoutez `C:\Program Files\flutter\bin` au PATH système
3. Redémarrez PowerShell

**Option 3 : Utiliser le wrapper**
Utilisez toujours le script wrapper au lieu de `flutter` directement :

```powershell
.\flutter.ps1 --version
.\flutter.ps1 pub get
.\flutter.ps1 run
```

## Commandes utiles

```powershell
# Activer Flutter dans cette session
.\activer_flutter.ps1

# Utiliser le wrapper (toujours fonctionne)
.\flutter.ps1 --version
.\flutter.ps1 pub get
.\flutter.ps1 run

# Installer dépendances
.\install_direct.ps1

# Vérifier le projet
.\verifier_projet.ps1
```

## Vérification

Pour vérifier que Flutter fonctionne :

```powershell
.\activer_flutter.ps1
```

OU

```powershell
.\flutter.ps1 --version
```

Si les deux fonctionnent, vous pouvez utiliser soit `flutter` directement (après activation), soit `.\flutter.ps1` (toujours).

