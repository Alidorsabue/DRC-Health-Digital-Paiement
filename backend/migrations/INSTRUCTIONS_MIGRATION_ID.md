# Instructions pour la migration du format d'ID des prestataires

## ⚠️ IMPORTANT

TypeORM essaie de synchroniser automatiquement le schéma, mais cela échoue car la colonne `id` contient des valeurs NULL ou le changement de type ne peut pas être fait automatiquement.

## Solution : Migration manuelle

### Option 1 : Désactiver synchronize et exécuter la migration SQL

1. **Désactiver synchronize** (déjà fait dans `database.config.ts`)
   - `synchronize: false` empêche TypeORM de modifier automatiquement le schéma

2. **Exécuter la migration SQL manuellement**
   ```bash
   # Se connecter à PostgreSQL
   psql -U postgres -d drc_digit_payment
   
   # Exécuter le script de migration
   \i backend/migrations/change_prestataire_id_format.sql
   ```

3. **Redémarrer l'application**
   - Après la migration, redémarrez le serveur backend

### Option 2 : Si vous avez déjà des prestataires avec des IDs NULL

Si vous avez des prestataires existants avec des IDs NULL, vous devez d'abord les supprimer ou leur assigner des IDs :

```sql
-- Option A: Supprimer les prestataires sans ID (si ce sont des données de test)
DELETE FROM prestataires WHERE id IS NULL;

-- Option B: Générer des IDs pour les prestataires sans ID
UPDATE prestataires 
SET id = CONCAT(
  'ID-',
  TO_CHAR("createdAt", 'YYMMDD'),
  '-',
  TO_CHAR("createdAt", 'HH24MI'),
  '-',
  LPAD((FLOOR(RANDOM() * 90 + 10))::TEXT, 2, '0')
)
WHERE id IS NULL;
```

### Option 3 : Migration TypeORM (recommandé pour production)

Si vous préférez utiliser les migrations TypeORM au lieu de synchronize :

1. Installer TypeORM CLI (si pas déjà installé)
   ```bash
   npm install -g typeorm
   ```

2. Créer une migration TypeORM
   ```bash
   typeorm migration:create -n ChangePrestataireIdFormat
   ```

3. Implémenter la migration dans le fichier généré

4. Exécuter les migrations
   ```bash
   npm run typeorm migration:run
   ```

## Vérification après migration

Après avoir exécuté la migration, vérifiez :

```sql
-- Vérifier que tous les prestataires ont un ID valide
SELECT COUNT(*) FROM prestataires WHERE id IS NULL;
-- Doit retourner 0

-- Vérifier le format des IDs
SELECT id FROM prestataires LIMIT 10;
-- Doit être au format ID-YYMMDD-HHMM-XX

-- Vérifier l'unicité
SELECT id, COUNT(*) FROM prestataires GROUP BY id HAVING COUNT(*) > 1;
-- Ne doit retourner aucune ligne
```

## En cas de problème

Si la migration échoue :

1. **Annuler la migration** : Utilisez `ROLLBACK` si vous êtes dans une transaction
2. **Vérifier les contraintes** : Assurez-vous que toutes les tables référençant `prestataires.id` sont compatibles
3. **Sauvegarder les données** : Toujours faire une sauvegarde avant une migration importante
















