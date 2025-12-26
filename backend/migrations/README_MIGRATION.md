# Guide d'exécution de la migration du format d'ID des prestataires

## ⚠️ IMPORTANT

Cette migration change le format de l'ID des prestataires de UUID vers `ID-YYMMDD-HHMM-XX`.

**Assurez-vous de faire une sauvegarde de votre base de données avant d'exécuter cette migration !**

## Méthodes d'exécution

### Option 1 : Via Node.js (Recommandé - Fonctionne sans psql)

```bash
cd backend
npm run migration:prestataire-id
```

Ou directement :

```bash
cd backend
node scripts/run-migration-simple.js
```

### Option 2 : Via PowerShell (Essaie psql puis Node.js)

```powershell
cd backend
.\run-migration.ps1
```

### Option 3 : Via psql directement (si installé et dans le PATH)

```bash
psql -U postgres -d drc_digit_payment -f migrations/change_prestataire_id_format.sql
```

### Option 4 : Via pgAdmin ou DBeaver

1. Ouvrez pgAdmin ou DBeaver
2. Connectez-vous à votre base de données PostgreSQL
3. Ouvrez le fichier `backend/migrations/change_prestataire_id_format.sql`
4. Exécutez le script SQL

## Configuration

Le script lit automatiquement les variables d'environnement depuis le fichier `.env` :

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=drc_digit_payment
```

Si le fichier `.env` n'existe pas, les valeurs par défaut seront utilisées.

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

## En cas d'erreur

Si la migration échoue :

1. **Vérifiez les logs** : Le script affiche des messages détaillés sur les erreurs
2. **Vérifiez les contraintes** : Assurez-vous que toutes les tables référençant `prestataires.id` sont compatibles
3. **Restaurez la sauvegarde** : Si nécessaire, restaurez votre sauvegarde et réessayez

## Après la migration

Une fois la migration réussie :

1. **Redémarrez le serveur backend** : `npm run start:dev`
2. **Vérifiez que l'application fonctionne** : Testez la création d'un nouveau prestataire pour vérifier que les nouveaux IDs sont générés correctement
















