# Guide: Vérifier que le Backend Fonctionne sur Railway

## 🔍 Diagnostic Rapide

### Étape 1: Vérifier les Logs

1. Allez dans Railway → Votre service backend
2. Cliquez sur **Deployments**
3. Cliquez sur le dernier déploiement
4. Regardez les **Deploy Logs**

**Vous devriez voir** :
```
🚀 Application démarrée avec succès!
📡 Écoute sur toutes les interfaces (0.0.0.0:XXXX)
```

**Si vous voyez des erreurs** :
- "Cannot connect to database" → Problème de connexion DB
- "Port already in use" → Problème de port
- "JWT_SECRET is not defined" → Variable manquante

### Étape 2: Vérifier les Variables d'Environnement

Dans Railway → Settings → Variables, vérifiez que vous avez :

```
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
PORT=${{PORT}}
NODE_ENV=production
JWT_SECRET=votre-secret-jwt-securise
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://votre-frontend.up.railway.app
```

**⚠️ IMPORTANT** : Utilisez `${{Postgres.XXX}}` et non des valeurs en dur !

### Étape 3: Vérifier PostgreSQL

1. Allez dans votre service PostgreSQL sur Railway
2. Vérifiez qu'il est **"Active"** (vert)
3. Si ce n'est pas le cas, cliquez sur **Restart**

### Étape 4: Tester l'API

Une fois que les logs montrent "Application démarrée", testez :

1. **Swagger** : `https://votre-backend.up.railway.app/api`
2. **Health check** : `https://votre-backend.up.railway.app/` (devrait retourner quelque chose)

## 🐛 Erreur 502 - Solutions

### Solution 1: Vérifier les Logs

Les logs vous diront exactement ce qui ne va pas. Regardez les **Deploy Logs** dans Railway.

### Solution 2: Vérifier la Connexion à la Base de Données

Si vous voyez "Cannot connect to database" :

1. Vérifiez que PostgreSQL est démarré
2. Vérifiez les variables d'environnement DB_*
3. Utilisez `${{Postgres.PGHOST}}` et non une valeur en dur

### Solution 3: Redémarrer le Service

1. Railway → Votre service backend
2. Settings → **Restart** ou **Redeploy**

### Solution 4: Vérifier le Port

Assurez-vous que votre code utilise :
```typescript
const port = process.env.PORT || 3001;
await app.listen(port, '0.0.0.0');
```

## 📋 Checklist de Vérification

- [ ] PostgreSQL est "Active" dans Railway
- [ ] Variables d'environnement configurées (DB_*, PORT, JWT_SECRET)
- [ ] Logs montrent "Application démarrée avec succès"
- [ ] Pas d'erreurs dans les Deploy Logs
- [ ] Swagger accessible : `https://votre-backend.up.railway.app/api`
- [ ] L'application écoute sur `0.0.0.0` et `process.env.PORT`

## 🆘 Si l'Erreur Persiste

1. **Partagez les Deploy Logs** (dernières 50 lignes)
2. **Vérifiez la configuration** dans Settings
3. **Essayez de redéployer** depuis le début

