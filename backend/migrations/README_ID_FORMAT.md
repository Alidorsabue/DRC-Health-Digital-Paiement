# Migration : Format d'ID des Prestataires

## Format d'ID

Chaque prestataire enregistré est identifié par un ID unique au format :
```
ID-YYMMDD-HHMM-XX
```

Où :
- **YYMMDD** = Année (2 chiffres) + Mois (2 chiffres) + Jour (2 chiffres)
  - Exemple : `251205` = 25 décembre 2025
- **HHMM** = Heure (2 chiffres) + Minute (2 chiffres)
  - Exemple : `1810` = 18h10
- **XX** = Nombre aléatoire unique (10-99, ou 100-999 en cas de collision)
  - Exemple : `44`

### Exemple complet
```
ID-251205-1810-44
```

## Migration de la base de données

### Étape 1 : Exécuter la migration SQL

Exécutez le script `change_prestataire_id_format.sql` sur votre base de données PostgreSQL.

**⚠️ ATTENTION :** Cette migration modifie la structure de la table `prestataires`. Assurez-vous de :
1. Faire une sauvegarde complète de la base de données
2. Vérifier que toutes les tables référençant `prestataires.id` sont compatibles
3. Tester la migration sur un environnement de développement d'abord

### Étape 2 : Vérifier les contraintes de clé étrangère

La table `validations_it` référence `prestataires.id` via `prestataire_id`. 
Assurez-vous que cette colonne est également compatible avec le nouveau format VARCHAR(20).

### Étape 3 : Migration des données existantes

Si vous avez des prestataires existants avec des UUID, la migration SQL génère automatiquement de nouveaux IDs basés sur leur date de création. Vérifiez l'unicité après la migration.

## Fonctionnement

### Génération automatique

L'ID est généré automatiquement lors de la création d'un prestataire via :
- `PrestatairesService.create()` - Pour les créations par les utilisateurs IT
- `PrestatairesService.createPublic()` - Pour les soumissions publiques

### Vérification d'unicité

La fonction `generatePrestataireId()` :
1. Génère un ID basé sur la date/heure actuelle
2. Vérifie l'unicité dans la base de données
3. En cas de collision, génère un nouveau nombre aléatoire
4. Si trop de collisions (>50), augmente la plage aléatoire (100-999)
5. En dernier recours, utilise un timestamp en millisecondes

## Exemples d'utilisation

### Création via API IT
```typescript
POST /prestataires
{
  "nom": "Doe",
  "prenom": "John",
  ...
}
// Retourne un prestataire avec id: "ID-251205-1810-44"
```

### Création via soumission publique
```typescript
POST /forms/public/{formId}/submit
{
  "data": { ... }
}
// Crée automatiquement un prestataire avec un ID généré
```

## Notes importantes

1. **Unicité garantie** : La fonction vérifie toujours l'unicité avant de retourner un ID
2. **Format fixe** : Le format est toujours `ID-YYMMDD-HHMM-XX` (20 caractères max)
3. **Rétrocompatibilité** : Les anciens UUID ne seront plus générés après la migration
4. **Performance** : Un index unique est créé sur la colonne `id` pour optimiser les recherches
















