# Dépannage Erreur 502 - Backend Railway

Une erreur 502 (Bad Gateway) signifie que Railway ne peut pas se connecter à votre application backend.

## 🔍 Diagnostic

### Étape 1: Vérifier les Logs

Dans Railway Dashboard :
1. Allez dans votre service backend
2. Cliquez sur **Deployments**
3. Cliquez sur le dernier déploiement
4. Regardez les **Deploy Logs**

**Cherchez** :
- Des erreurs de démarrage
- Des erreurs de connexion à la base de données
- Des erreurs de port
- Des messages comme "Application démarrée" ou "Listening on port"

### Étape 2: Vérifier les Variables d'Environnement

Dans Railway → Settings → Variables, vérifiez :

**Obligatoires** :
- `DB_HOST=${{Postgres.PGHOST}}`
- `DB_PORT=${{Postgres.PGPORT}}`
- `DB_USERNAME=${{Postgres.PGUSER}}`
- `DB_PASSWORD=${{Postgres.PGPASSWORD}}`
- `DB_NAME=${{Postgres.PGDATABASE}}`
- `PORT=${{PORT}}`
- `NODE_ENV=production`
- `JWT_SECRET` (doit être défini)

### Étape 3: Vérifier que PostgreSQL est Démarré

1. Allez dans votre service PostgreSQL sur Railway
2. Vérifiez qu'il est **"Active"**
3. Si ce n'est pas le cas, redémarrez-le

## 🐛 Causes Courantes et Solutions

### Cause 1: Erreur de Connexion à la Base de Données

**Symptômes** : Logs montrent "Cannot connect to database" ou "Connection refused"

**Solution** :
1. Vérifiez que PostgreSQL est démarré
2. Vérifiez que les variables d'environnement de la base de données sont correctes
3. Vérifiez que vous utilisez `${{Postgres.PGHOST}}` et non une valeur en dur

### Cause 2: Application ne Démarre Pas

**Symptômes** : Pas de message "Application démarrée" dans les logs

**Solution** :
1. Vérifiez les logs pour voir l'erreur exacte
2. Vérifiez que `PORT` est bien utilisé dans le code
3. Vérifiez que l'application écoute sur `0.0.0.0` et non `localhost`

### Cause 3: Port Incorrect

**Symptômes** : Application démarre mais Railway ne peut pas se connecter

**Solution** :
Vérifiez que votre `main.ts` utilise :
```typescript
const port = process.env.PORT || 3001;
await app.listen(port, '0.0.0.0');
```

### Cause 4: Migrations Non Exécutées

**Symptômes** : Erreurs liées aux tables manquantes

**Solution** :
Exécutez les migrations (voir `EXECUTER_MIGRATIONS_RAILWAY.md`)

### Cause 5: Variables d'Environnement Manquantes

**Symptômes** : Erreurs comme "JWT_SECRET is not defined"

**Solution** :
Ajoutez toutes les variables requises dans Railway → Settings → Variables

## 🔧 Solutions Rapides

### Solution 1: Redémarrer le Service

1. Dans Railway → Votre service backend
2. Cliquez sur **Settings**
3. Cliquez sur **Restart** ou **Redeploy**

### Solution 2: Vérifier via Railway CLI

```bash
# Voir les logs en temps réel
railway logs --service votre-service-backend

# Voir les variables
railway variables

# Redémarrer
railway restart
```

### Solution 3: Vérifier le Code de Démarrage

Assurez-vous que `backend/src/main.ts` contient :
```typescript
const port = process.env.PORT || 3001;
await app.listen(port, '0.0.0.0');
```

## 📋 Checklist de Diagnostic

- [ ] PostgreSQL est démarré et "Active"
- [ ] Toutes les variables d'environnement sont configurées
- [ ] Les logs montrent "Application démarrée" ou "Listening on port"
- [ ] Pas d'erreurs de connexion à la base de données
- [ ] Le port est correctement configuré (`process.env.PORT`)
- [ ] L'application écoute sur `0.0.0.0` et non `localhost`
- [ ] Les migrations ont été exécutées (si nécessaire)

## 🆘 Si Rien ne Fonctionne

1. **Partagez les logs complets** depuis Railway
2. **Vérifiez la configuration** dans Settings → Build et Settings → Deploy
3. **Essayez de redéployer** depuis le début

## 📝 Logs à Partager pour Aide

Si vous avez besoin d'aide, partagez :
1. Les **Deploy Logs** complets (dernières 50 lignes)
2. Les **Build Logs** (si le build a réussi)
3. Une capture d'écran de **Settings → Variables**
4. Le statut de **PostgreSQL** (Active/Inactive)

