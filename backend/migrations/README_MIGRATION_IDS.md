# Migration des IDs vers le nouveau format ID-YYMM-HHmm-XXX

## Format d'ID

Le nouveau format d'ID est : `ID-YYMM-HHmm-XXX`

Où :
- **YYMM** = Année (2 chiffres) + Mois (2 chiffres) - **SANS le jour**
- **HHmm** = Heure (2 chiffres) + Minute (2 chiffres)
- **XXX** = Nombre aléatoire unique (100-999, 3 chiffres)

### Exemple
```
ID-2512-1137-102
```
- `2512` = Décembre 2025
- `1137` = 11h37
- `102` = Nombre aléatoire

## Modifications apportées

### Backend

1. **`backend/src/common/utils/id-generator.util.ts`** :
   - `generatePrestataireId()` : Modifié pour utiliser le format `ID-YYMM-HHmm-XXX` (sans le jour)
   - `generateSubmissionId()` : Nouvelle fonction pour générer les IDs de soumission au même format

2. **`backend/src/forms/forms-public.controller.ts`** :
   - Remplacement de `randomUUID()` par `generateSubmissionId()` pour générer les IDs de soumission

3. **`backend/migrations/migrate_ids_to_new_format.sql`** :
   - Migration SQL pour mettre à jour les IDs existants dans :
     - Table `prestataires`
     - Tables `form_*` (submission_id)
     - Tables référencées (`validations_it`, `payments`)

### Mobile

1. **`mobile/lib/services/database_service.dart`** :
   - `generateSubmissionId()` : Génère déjà les IDs au bon format
   - `migrateSubmissionIds()` : Migration locale des IDs existants
   - `updateSubmissionId()` : Nouvelle fonction pour mettre à jour l'ID après synchronisation

2. **`mobile/lib/services/sync_service.dart`** :
   - Mise à jour pour utiliser l'ID retourné par le backend lors de la synchronisation

3. **`mobile/lib/main.dart`** :
   - Migration automatique au démarrage (une seule fois)

4. **`mobile/lib/screens/settings_screen.dart`** :
   - Bouton pour forcer la réexécution de la migration manuellement

## Exécution de la migration

### Backend (PostgreSQL)

#### Méthode 1 : Script Node.js (Recommandé - Fonctionne sans psql)

1. **Sauvegarder la base de données** (optionnel mais recommandé) :
   ```bash
   # Si vous avez psql installé
   pg_dump -U postgres drc_digit_payment > backup_before_migration.sql
   ```

2. **Exécuter la migration via Node.js** :
   ```bash
   cd backend
   npm run migration:ids
   ```
   
   Ou directement :
   ```bash
   node scripts/run-migration-ids.js --yes
   ```

#### Méthode 2 : psql (si installé)

1. **Sauvegarder la base de données** :
   ```bash
   pg_dump -U postgres drc_digit_payment > backup_before_migration.sql
   ```

2. **Exécuter la migration SQL** :
   ```bash
   psql -U postgres -d drc_digit_payment -f backend/migrations/migrate_ids_to_new_format.sql
   ```

#### Méthode 3 : pgAdmin (Interface graphique)

1. Ouvrir pgAdmin
2. Se connecter à la base de données `drc_digit_payment`
3. Ouvrir l'éditeur de requête SQL
4. Ouvrir le fichier `backend/migrations/migrate_ids_to_new_format.sql`
5. Exécuter le script (F5)

3. **Vérifier la migration** :
   ```sql
   -- Vérifier les prestataires
   SELECT COUNT(*) FROM prestataires WHERE id LIKE 'ID-____-____-___';
   
   -- Vérifier les soumissions (remplacer form_id par un ID réel)
   SELECT COUNT(*) FROM form_<form_id> WHERE submission_id LIKE 'ID-____-____-___';
   ```

### Mobile

La migration s'exécute automatiquement au premier démarrage après la mise à jour du code.

Pour forcer la réexécution :
1. Ouvrir l'application
2. Aller dans **Paramètres**
3. Cliquer sur **"Migrer les IDs de soumission"**

## Notes importantes

1. **Unicité garantie** : Les fonctions de génération vérifient toujours l'unicité avant de retourner un ID
2. **Format fixe** : Le format est toujours `ID-YYMM-HHmm-XXX` (17 caractères)
3. **Rétrocompatibilité** : Les anciens IDs (UUID ou numériques) seront migrés automatiquement
4. **Performance** : Un index unique est créé sur la colonne `id` pour optimiser les recherches

## Vérification après migration

### Backend

```sql
-- Vérifier qu'il n'y a plus d'IDs au ancien format
SELECT COUNT(*) FROM prestataires WHERE id NOT LIKE 'ID-____-____-___';
-- Devrait retourner 0

-- Vérifier l'unicité
SELECT id, COUNT(*) FROM prestataires GROUP BY id HAVING COUNT(*) > 1;
-- Ne devrait retourner aucune ligne
```

### Mobile

Vérifier les logs lors du démarrage :
```
=== DÉMARRAGE DE LA MIGRATION DES IDs DE SOUMISSION ===
DEBUG migrateSubmissionIds: X soumissions trouvées
DEBUG migrateSubmissionIds: Y soumissions migrées
=== MIGRATION TERMINÉE: Y soumissions migrées ===
```

## Problèmes potentiels

### Collisions d'IDs

Si la migration détecte des collisions :
- La migration utilise automatiquement les millisecondes ou un suffixe personnalisé
- Les logs afficheront les IDs migrés pour vérification

### Erreurs de migration

Si la migration échoue :
1. Restaurer la sauvegarde
2. Vérifier les logs d'erreur
3. Corriger le problème
4. Réessayer la migration

## Support

En cas de problème, vérifier :
1. Les logs du backend (console)
2. Les logs du mobile (Flutter DevTools)
3. Les contraintes de clé étrangère dans PostgreSQL

