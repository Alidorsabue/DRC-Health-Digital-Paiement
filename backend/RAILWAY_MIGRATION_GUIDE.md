# Guide de Migration sur Railway

## Exécuter la migration `rename_status_to_validation_status` sur Railway

### Option 1 : Via Railway CLI (Recommandé)

1. **Installer Railway CLI** (si pas déjà installé) :
   ```bash
   npm install -g @railway/cli
   ```

2. **Se connecter à Railway** :
   ```bash
   railway login
   ```

3. **Se connecter à votre projet** :
   ```bash
   railway link
   ```
   Ou si vous connaissez l'ID du projet :
   ```bash
   railway link <project-id>
   ```

4. **Exécuter la migration** :
   ```bash
   railway run npm run migration:validation-status
   ```

### Option 2 : Via Railway Dashboard (Console Web)

1. **Accéder à votre projet** sur [railway.app](https://railway.app)

2. **Aller dans l'onglet "Variables"** pour vérifier que les variables d'environnement sont configurées :
   - `POSTGRES_URL` ou `DATABASE_URL` (généralement configuré automatiquement par Railway)
   - Ou les variables individuelles : `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

3. **Aller dans l'onglet "Deployments"** et cliquer sur votre service backend

4. **Ouvrir la console** (onglet "Logs" ou "Shell")

5. **Exécuter la commande** :
   ```bash
   npm run migration:validation-status
   ```

### Option 3 : Via un service temporaire Railway

1. **Créer un nouveau service** dans votre projet Railway

2. **Configurer le service** :
   - **Source** : Connecter au même repository GitHub
   - **Root Directory** : `backend`
   - **Build Command** : `npm install`
   - **Start Command** : `npm run migration:validation-status`

3. **Déployer** le service (il s'arrêtera automatiquement après l'exécution)

4. **Vérifier les logs** pour confirmer que la migration s'est bien exécutée

### Option 4 : Via un script de déploiement

Ajoutez la migration dans votre processus de déploiement automatique :

1. **Modifier votre `Dockerfile`** ou **script de déploiement** pour inclure :
   ```dockerfile
   # Dans votre Dockerfile
   RUN npm run migration:validation-status || true
   ```
   (Le `|| true` permet au déploiement de continuer même si la migration échoue)

2. **Ou créer un script de pré-déploiement** dans Railway :
   - Créer un fichier `railway-migrate.sh` :
   ```bash
   #!/bin/bash
   npm run migration:validation-status
   ```
   - L'exécuter avant le démarrage de l'application

## Vérification après migration

Après avoir exécuté la migration, vérifiez que :

1. **Les colonnes ont été renommées** :
   ```sql
   SELECT table_name, column_name 
   FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name LIKE 'form_%' 
   AND column_name IN ('status', 'validation_status')
   ORDER BY table_name, column_name;
   ```
   Vous devriez voir `validation_status` et **pas** `status`.

2. **Les données ont été migrées** :
   ```sql
   SELECT 
     COUNT(*) as total,
     COUNT(CASE WHEN validation_status = 'VALIDE_PAR_IT' THEN 1 END) as valides_it,
     COUNT(CASE WHEN approval_status = 'APPROUVE_PAR_MCZ' THEN 1 END) as approuves_mcz
   FROM form_<votre_form_id>;
   ```

3. **L'application fonctionne correctement** :
   - Vérifier que les prestataires s'affichent correctement
   - Vérifier que les compteurs "VALIDÉS PAR IT" sont corrects

## Dépannage

### Erreur : "Cannot find module 'pg'"
```bash
npm install pg
```

### Erreur : "Connection refused"
- Vérifiez que `POSTGRES_URL` ou `DATABASE_URL` est correctement configuré
- Vérifiez que le service PostgreSQL est actif sur Railway

### Erreur : "SSL required"
- Le script configure automatiquement SSL pour Railway
- Si vous avez encore des problèmes, vérifiez que `DB_SSL=true` est défini

### Erreur : "Table does not exist"
- Vérifiez que les tables `form_*` existent dans votre base de données
- La migration ne crée pas de tables, elle modifie seulement les colonnes existantes

## Notes importantes

⚠️ **Sauvegarde** : Faites toujours une sauvegarde de votre base de données avant d'exécuter une migration en production.

⚠️ **Test** : Testez d'abord la migration sur un environnement de développement/staging.

⚠️ **Rollback** : Si la migration échoue, vous pouvez restaurer depuis votre sauvegarde. Il n'y a pas de script de rollback automatique pour cette migration.

