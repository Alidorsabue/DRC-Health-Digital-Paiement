# Application Mobile DRC Digit Payment

Application mobile Flutter pour la collecte de données avec synchronisation offline, similaire à KoboCollect.

## Fonctionnalités

- ✅ **Interface pour IT** : Authentification et gestion des utilisateurs IT
- ✅ **Rendu dynamique des formulaires** : Génération automatique des formulaires à partir de schémas JSON
- ✅ **Synchronisation offline** : Stockage local avec SQLite et synchronisation automatique
- ✅ **Interface similaire à KoboCollect** : Design et UX inspirés de KoboCollect

## Types de champs supportés

- Texte (`text`)
- Nombre entier (`integer`)
- Nombre décimal (`decimal`)
- Date (`date`)
- Date et heure (`datetime`)
- Sélection unique (`select_one`)
- Sélection multiple (`select_multiple`)
- Note (`note`)

## Installation

### Méthode 1 : Script automatique (Recommandé)

**Sur Windows :**

1. **Vérifiez d'abord Flutter** (si vous avez des erreurs) :
   ```powershell
   .\check_flutter.ps1
   ```

2. **Installez les dépendances** :
   Double-cliquez sur `install.bat` ou exécutez dans PowerShell :
   ```powershell
   .\install.ps1
   ```

**⚠️ Si vous obtenez une erreur "Flutter n'est pas installé" :**
- Suivez les instructions dans `TROUBLESHOOTING.md`
- Ou exécutez `.\check_flutter.ps1` pour diagnostiquer le problème

### Méthode 2 : Installation manuelle

1. Assurez-vous d'avoir Flutter installé (SDK >=3.0.0)
   - Vérifiez avec : `flutter --version`
   - Si Flutter n'est pas installé : https://flutter.dev/docs/get-started/install/windows

2. Ouvrez PowerShell ou CMD dans le répertoire `mobile`

3. Installez les dépendances :
```powershell
flutter pub get
```

**⚠️ Important :** Si Windows vous demande d'ouvrir `pubspec.yaml` avec une autre application :
- Ne double-cliquez **PAS** sur le fichier
- Utilisez la ligne de commande (PowerShell/CMD) comme indiqué ci-dessus
- Voir `TROUBLESHOOTING.md` pour plus d'aide

3. Configurez l'URL de l'API dans les paramètres de l'application (par défaut: `http://localhost:3001`)

4. Lancez l'application :
```bash
flutter run
```

## Structure du projet

```
lib/
├── main.dart                 # Point d'entrée de l'application
├── models/                   # Modèles de données
│   ├── form.dart
│   ├── form_submission.dart
│   ├── user.dart
│   └── campaign.dart
├── services/                 # Services (API, Database, Sync, Auth)
│   ├── api_service.dart
│   ├── database_service.dart
│   ├── sync_service.dart
│   └── auth_service.dart
├── providers/                # Providers pour la gestion d'état
│   ├── auth_provider.dart
│   ├── forms_provider.dart
│   ├── submissions_provider.dart
│   └── sync_provider.dart
├── screens/                  # Écrans de l'application
│   ├── login_screen.dart
│   ├── forms_list_screen.dart
│   ├── form_fill_screen.dart
│   ├── sync_screen.dart
│   ├── settings_screen.dart
│   └── submissions_list_screen.dart
└── widgets/                  # Widgets réutilisables
    └── form_fields/
        ├── dynamic_form_field.dart
        └── form_field_group.dart
```

## Utilisation

### Connexion

1. Ouvrez l'application
2. Entrez vos identifiants IT
3. Cliquez sur "Se connecter"

### Synchronisation

1. Allez dans l'écran "Synchronisation"
2. Cliquez sur "Synchroniser maintenant"
3. Les formulaires et campagnes seront téléchargés
4. Les soumissions en attente seront synchronisées

### Remplir un formulaire

1. Sélectionnez un formulaire dans la liste
2. Remplissez les champs
3. Cliquez sur "Sauvegarder"
4. La soumission sera stockée localement et synchronisée automatiquement

### Voir les soumissions

1. Dans un formulaire, cliquez sur l'icône de liste
2. Consultez toutes les soumissions
3. Les soumissions en erreur peuvent être réessayées

## Configuration

L'URL de l'API peut être modifiée dans les paramètres de l'application. Par défaut, elle est définie sur `http://localhost:3001`.

## Synchronisation offline

L'application fonctionne entièrement en mode offline :
- Les formulaires sont stockés localement
- Les soumissions sont sauvegardées localement
- La synchronisation se fait automatiquement lorsque la connexion est disponible
- Les soumissions en erreur peuvent être réessayées manuellement

## Dépendances principales

- `flutter_form_builder` : Gestion des formulaires
- `sqflite` : Base de données SQLite locale
- `dio` : Client HTTP pour les appels API
- `provider` : Gestion d'état
- `connectivity_plus` : Détection de la connexion
- `shared_preferences` : Stockage des préférences

## Notes

- L'application nécessite une connexion internet pour la synchronisation initiale
- Les formulaires doivent être publiés sur le serveur pour être disponibles
- Les soumissions sont stockées localement jusqu'à synchronisation réussie
