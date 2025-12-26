# Guide de dépannage - Application Flutter

## Problème : "Ouvrir avec une autre application" lors de `flutter pub get`

Si Windows vous demande d'ouvrir `pubspec.yaml` avec une autre application, cela signifie probablement que :

1. **Vous avez double-cliqué sur le fichier** au lieu d'utiliser la ligne de commande
2. **Le fichier est associé à un éditeur** par défaut

### Solution

**Utilisez la ligne de commande (Terminal/PowerShell) :**

1. Ouvrez PowerShell ou CMD dans le répertoire `mobile`
2. Exécutez la commande :
   ```powershell
   flutter pub get
   ```

**OU depuis le répertoire racine :**

```powershell
cd mobile
flutter pub get
```

## Vérification de l'installation Flutter

Pour vérifier que Flutter est correctement installé :

```powershell
flutter doctor
```

Cette commande vous indiquera :
- Si Flutter est installé
- Si les outils nécessaires sont disponibles
- Les problèmes éventuels

## Installation de Flutter (si nécessaire)

### Vérification rapide

Exécutez le script de vérification :
```powershell
.\check_flutter.ps1
```

Ce script vous indiquera :
- Si Flutter est installé
- Où Flutter se trouve
- Si Flutter est dans le PATH
- Comment résoudre les problèmes

### Installation complète de Flutter

Si Flutter n'est pas installé :

1. **Téléchargez Flutter**
   - Allez sur : https://flutter.dev/docs/get-started/install/windows
   - Téléchargez le SDK Flutter (fichier ZIP)

2. **Extrayez l'archive**
   - Créez un dossier (ex: `C:\src`)
   - Extrayez le contenu dans `C:\src\flutter`
   - ⚠️ Ne pas extraire dans un dossier avec des espaces ou des caractères spéciaux

3. **Ajoutez Flutter au PATH**
   - Appuyez sur `Win + R`, tapez `sysdm.cpl` et appuyez sur Entrée
   - Allez dans l'onglet "Avancé"
   - Cliquez sur "Variables d'environnement"
   - Dans "Variables système", trouvez "Path" et cliquez sur "Modifier"
   - Cliquez sur "Nouveau" et ajoutez : `C:\src\flutter\bin`
   - Cliquez sur "OK" pour fermer toutes les fenêtres

4. **Redémarrez PowerShell/CMD**
   - Fermez complètement PowerShell/CMD
   - Rouvrez-le en tant qu'administrateur (optionnel mais recommandé)

5. **Vérifiez l'installation**
   ```powershell
   flutter --version
   flutter doctor
   ```

### Résolution des problèmes courants

**Problème : "flutter: command not found"**
- Flutter n'est pas dans le PATH
- Solution : Ajoutez le chemin `flutter\bin` au PATH système (voir étape 3 ci-dessus)

**Problème : "SDK location not found"**
- Flutter n'est pas correctement installé
- Solution : Réinstallez Flutter en suivant les étapes ci-dessus

**Problème : Erreurs de permissions**
- Exécutez PowerShell en tant qu'administrateur
- Ou installez Flutter dans un dossier accessible (ex: `C:\src\flutter`)

## Commandes utiles

```powershell
# Vérifier la version de Flutter
flutter --version

# Obtenir les dépendances
flutter pub get

# Analyser le code
flutter analyze

# Nettoyer le projet
flutter clean

# Lancer l'application
flutter run
```

## Problèmes courants

### Erreur : "flutter: command not found"
- Flutter n'est pas dans le PATH
- Solution : Ajoutez Flutter au PATH système

### Erreur : "SDK location not found"
- Flutter n'est pas correctement installé
- Solution : Réinstallez Flutter

### Erreur lors de `flutter pub get`
- Vérifiez votre connexion internet
- Vérifiez que le fichier `pubspec.yaml` est valide
- Essayez `flutter clean` puis `flutter pub get`

## Support

Si le problème persiste, vérifiez :
1. La version de Flutter : `flutter --version`
2. L'état de l'installation : `flutter doctor`
3. Les logs d'erreur complets

