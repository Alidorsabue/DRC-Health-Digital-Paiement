# Guide de Test - Filtrage par Aire de Santé

Ce guide explique comment tester les modifications apportées pour filtrer les prestataires par aire de santé dans l'application mobile.

## 📋 Prérequis

1. **Backend démarré** : Le serveur backend doit être en cours d'exécution
2. **Utilisateur IT de test** : Un utilisateur IT avec :
   - Rôle : `IT`
   - Aire de santé : `as_agetraf` (ou une autre aire de votre choix)
   - Zone de santé : `zs_tshamilemba` (ou la zone correspondante)
   - Des prestataires enregistrés dans cette aire
   - Des prestataires enregistrés dans d'autres aires (pour vérifier le filtrage)

## 🚀 Étapes de Test

### 1. Préparation de l'environnement

#### Option A : Tester sur un émulateur/device physique
```bash
cd mobile
flutter pub get
flutter run
```

#### Option B : Construire un APK pour tester
```bash
cd mobile
flutter build apk --release
# L'APK sera dans mobile/build/app/outputs/flutter-apk/app-release.apk
```

### 2. Connexion avec un utilisateur IT

1. **Lancer l'application mobile**
2. **Configurer l'URL du serveur** (si nécessaire) :
   - En développement : L'application détecte automatiquement l'IP
   - Ou configurez manuellement : `http://VOTRE_IP:3001`
3. **Se connecter avec un utilisateur IT** :
   - Identifiant : Nom d'utilisateur, téléphone ou email de l'utilisateur IT
   - Mot de passe : Le mot de passe de l'utilisateur IT
4. **Vérifier les informations utilisateur** :
   - Aller dans **Paramètres**
   - Vérifier que l'**Aire de santé** affichée correspond à `as_agetraf` (ou votre aire de test)
   - Vérifier que la **Zone de santé** affichée correspond à `zs_tshamilemba`

### 3. Test de l'écran KYC

**Objectif** : Vérifier que seuls les prestataires de l'aire de santé de l'IT sont affichés.

**Étapes** :
1. Naviguer vers l'écran **"Statut KYC"** depuis le menu principal
2. Observer la liste des prestataires affichés
3. **Vérifications** :
   - ✅ Seuls les prestataires de l'aire `as_agetraf` doivent être visibles
   - ✅ Aucun prestataire d'autres aires ne doit apparaître
   - ✅ Aucun prestataire d'autres zones ne doit apparaître
   - ✅ Aucun prestataire d'autres provinces ne doit apparaître
4. **Test de recherche** :
   - Utiliser la barre de recherche pour chercher un prestataire
   - Vérifier que seuls les prestataires de l'aire de santé sont trouvés
5. **Vérifier les logs** :
   - Ouvrir la console/logcat
   - Chercher les messages `DEBUG KYC:`
   - Vérifier les messages de filtrage :
     - `DEBUG KYC: Prestataire X inclus - aireId=as_agetraf`
     - `DEBUG KYC: Prestataire Y ignoré - aireId=autre_aire (attendu: as_agetraf)`

### 4. Test de l'écran Modifier Prestataire

**Objectif** : Vérifier que seuls les prestataires de l'aire de santé peuvent être modifiés.

**Étapes** :
1. Naviguer vers l'écran **"Modifier un prestataire"** depuis le menu principal
2. Observer la liste des prestataires affichés
3. **Vérifications** :
   - ✅ Seuls les prestataires de l'aire `as_agetraf` doivent être visibles
   - ✅ Aucun prestataire d'autres aires ne doit apparaître
4. **Test de modification** :
   - Sélectionner un prestataire de la liste
   - Modifier ses informations
   - Sauvegarder
   - Vérifier que la modification fonctionne
5. **Vérifier les logs** :
   - Chercher les messages `DEBUG MODIFY:`
   - Vérifier les messages de filtrage

### 5. Test de l'écran Rapport de Paiement

**Objectif** : Vérifier que seuls les prestataires de l'aire de santé apparaissent dans le rapport.

**Étapes** :
1. Naviguer vers l'écran **"Rapport de Paiement"** depuis le menu principal
2. Observer la liste des prestataires affichés
3. **Vérifications** :
   - ✅ Seuls les prestataires de l'aire `as_agetraf` doivent être visibles
   - ✅ Le résumé financier ne doit compter que les prestataires de cette aire
   - ✅ Aucun prestataire d'autres aires ne doit apparaître
4. **Test de filtrage par statut** :
   - Utiliser le filtre "Filtrer par statut de paiement"
   - Vérifier que le filtrage fonctionne correctement
5. **Test d'export** :
   - Cliquer sur l'icône de téléchargement pour exporter le rapport
   - Vérifier que seuls les prestataires de l'aire de santé sont dans le fichier exporté
6. **Vérifier les logs** :
   - Chercher les messages `DEBUG PAYMENT:`
   - Vérifier les messages de filtrage

### 6. Test de l'écran Soumissions Envoyées

**Objectif** : Vérifier que seuls les prestataires de l'aire de santé sont affichés.

**Étapes** :
1. Naviguer vers l'écran **"Soumissions Envoyées"** depuis le menu principal
2. Observer la liste des prestataires affichés
3. **Vérifications** :
   - ✅ Seuls les prestataires de l'aire `as_agetraf` doivent être visibles
   - ✅ Aucun prestataire d'autres aires ne doit apparaître
4. **Vérifier les logs** :
   - Chercher les messages `DEBUG SENT:`
   - Vérifier les messages de filtrage

### 7. Test de l'écran Rapport de Validation

**Objectif** : Vérifier que seuls les prestataires de l'aire de santé sont affichés.

**Étapes** :
1. Naviguer vers l'écran **"Rapport de Validation"** depuis le menu principal
2. Observer la liste des prestataires affichés
3. **Vérifications** :
   - ✅ Seuls les prestataires de l'aire `as_agetraf` doivent être visibles
   - ✅ Aucun prestataire d'autres aires ne doit apparaître
4. **Vérifier les logs** :
   - Chercher les messages `DEBUG validation_report:`
   - Vérifier les messages de filtrage

## 🔍 Points de Vérification Clés

### Vérification du Filtrage

Pour chaque écran, vérifier que :

1. **Les prestataires affichés appartiennent à l'aire de santé de l'IT** :
   - Vérifier le champ `aireId` ou `aire_id` de chaque prestataire
   - Il doit correspondre à l'`aireId` de l'utilisateur IT connecté

2. **Les prestataires d'autres aires ne sont pas affichés** :
   - Créer ou identifier des prestataires dans d'autres aires
   - Vérifier qu'ils n'apparaissent pas dans les listes

3. **Les prestataires d'autres zones ne sont pas affichés** :
   - Même si dans la même province, les prestataires d'autres zones ne doivent pas apparaître

4. **Les prestataires d'autres provinces ne sont pas affichés** :
   - Les prestataires d'autres provinces ne doivent absolument pas apparaître

### Vérification des Logs

Dans la console/logcat, rechercher les messages suivants :

**Messages attendus (prestataires inclus)** :
```
DEBUG [ECRAN]: Utilisateur connecté - role=IT, aireId=as_agetraf, userId=xxx
DEBUG [ECRAN]: Prestataire [ID] inclus - aireId=as_agetraf, enregistrePar=xxx
```

**Messages attendus (prestataires exclus)** :
```
DEBUG [ECRAN]: Prestataire [ID] ignoré - aireId=autre_aire (attendu: as_agetraf), enregistrePar=yyy (attendu: xxx)
```

## 🐛 Dépannage

### Problème : Tous les prestataires sont affichés

**Causes possibles** :
1. L'utilisateur connecté n'a pas d'`aireId` défini
2. Les prestataires n'ont pas d'`aireId` dans leurs données
3. Le filtrage côté client ne fonctionne pas

**Solutions** :
1. Vérifier dans **Paramètres** que l'aire de santé est bien affichée
2. Vérifier les logs pour voir les valeurs d'`aireId` comparées
3. Vérifier que les prestataires ont bien un champ `aireId` ou `aire_id` dans la base de données

### Problème : Aucun prestataire n'est affiché

**Causes possibles** :
1. Aucun prestataire n'a été enregistré dans cette aire de santé
2. Le filtrage est trop strict
3. Les données ne correspondent pas exactement

**Solutions** :
1. Vérifier qu'il existe des prestataires avec `aireId = as_agetraf` dans la base de données
2. Vérifier les logs pour voir pourquoi les prestataires sont ignorés
3. Vérifier la normalisation des IDs (espaces, casse)

### Problème : Certains prestataires de l'aire ne sont pas affichés

**Causes possibles** :
1. Le prestataire n'a pas été enregistré par cet IT (champ `enregistrePar` différent)
2. L'`aireId` du prestataire ne correspond pas exactement

**Solutions** :
1. Vérifier le champ `enregistrePar` du prestataire dans la base de données
2. Vérifier que l'`aireId` du prestataire correspond exactement à celui de l'IT
3. Le filtrage accepte les prestataires si :
   - `aireId` correspond OU
   - `enregistrePar` correspond à l'ID de l'utilisateur IT

## 📊 Cas de Test Recommandés

### Cas de Test 1 : IT avec prestataires dans son aire
- **Utilisateur** : IT avec `aireId = as_agetraf`
- **Données** : 5 prestataires dans `as_agetraf`, 3 dans `autre_aire`
- **Résultat attendu** : Seulement les 5 prestataires de `as_agetraf` sont affichés

### Cas de Test 2 : IT sans prestataires dans son aire
- **Utilisateur** : IT avec `aireId = as_agetraf`
- **Données** : 0 prestataire dans `as_agetraf`, 10 dans d'autres aires
- **Résultat attendu** : Aucun prestataire affiché, message "Aucun prestataire trouvé"

### Cas de Test 3 : IT avec prestataires enregistrés par lui-même
- **Utilisateur** : IT avec `id = user123`, `aireId = as_agetraf`
- **Données** : 3 prestataires avec `enregistrePar = user123` mais `aireId` différent
- **Résultat attendu** : Les 3 prestataires sont affichés (car `enregistrePar` correspond)

### Cas de Test 4 : IT avec prestataires d'autres zones
- **Utilisateur** : IT avec `aireId = as_agetraf`, `zoneId = zs_tshamilemba`
- **Données** : 5 prestataires dans `as_agetraf`, 5 dans `autre_aire` de `zs_tshamilemba`, 5 dans `autre_aire` de `autre_zone`
- **Résultat attendu** : Seulement les 5 prestataires de `as_agetraf` sont affichés

## ✅ Checklist de Validation

- [ ] L'application démarre correctement
- [ ] La connexion avec un utilisateur IT fonctionne
- [ ] L'écran Paramètres affiche correctement l'aire de santé
- [ ] L'écran KYC affiche uniquement les prestataires de l'aire de santé
- [ ] L'écran Modifier Prestataire affiche uniquement les prestataires de l'aire de santé
- [ ] L'écran Rapport de Paiement affiche uniquement les prestataires de l'aire de santé
- [ ] L'écran Soumissions Envoyées affiche uniquement les prestataires de l'aire de santé
- [ ] L'écran Rapport de Validation affiche uniquement les prestataires de l'aire de santé
- [ ] Les logs montrent correctement les prestataires inclus/exclus
- [ ] Aucun prestataire d'autres aires/zones/provinces n'est affiché
- [ ] La recherche fonctionne correctement avec le filtrage
- [ ] L'export du rapport de paiement contient uniquement les prestataires de l'aire de santé

## 📝 Notes Importantes

1. **Normalisation des IDs** : Le filtrage normalise les IDs (suppression des espaces, conversion en minuscules) pour gérer les différences de format

2. **Double vérification** : Le filtrage vérifie à la fois :
   - L'`aireId` du prestataire correspond à l'`aireId` de l'IT
   - OU le prestataire a été enregistré par cet IT (`enregistrePar` correspond)

3. **Logs de débogage** : Tous les écrans incluent des logs détaillés pour faciliter le débogage. Activez les logs dans votre environnement de développement pour voir les détails du filtrage.

4. **Performance** : Le filtrage se fait côté client après récupération des données. Pour de grandes quantités de données, envisagez d'implémenter le filtrage côté serveur.

