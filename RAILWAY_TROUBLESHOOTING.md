# Guide de Dépannage Railway

## Erreurs courantes et solutions

### Erreur: "couldn't locate the dockerfile at path Dockerfile"

**Cause**: Railway ne trouve pas le Dockerfile. Cela peut être dû à une mauvaise configuration du `rootDirectory` ou `dockerfilePath`.

**Solution**: 
1. Vérifiez que `railway.toml` contient:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"  # Relatif au rootDirectory
rootDirectory = "backend"  # ← Important !
```

2. **IMPORTANT**: Quand `rootDirectory = "backend"`, le `dockerfilePath` doit être relatif à ce répertoire, donc `Dockerfile` et non `backend/Dockerfile`.

3. Configurez dans le dashboard Railway:
   - Allez dans votre service → Settings → Build
   - Définissez **Root Directory** à `backend`
   - Définissez **Dockerfile Path** à `Dockerfile` (pas `backend/Dockerfile`)
   - Sauvegardez et redéployez

### Erreur: "failed to compute cache key: nest-cli.json not found"

**Cause**: Railway construit depuis la racine du projet, mais le Dockerfile est dans le dossier `backend/`.

**Solution**: 
1. Vérifiez que `railway.toml` contient:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"
rootDirectory = "backend"  # ← Important !
```

2. Le Dockerfile crée maintenant automatiquement `nest-cli.json` si nécessaire

### Erreur: "Security vulnerabilities detected"

**Cause**: Des dépendances ont des vulnérabilités de sécurité connues.

**Solution**:
1. Mettez à jour les packages vulnérables:
```bash
cd frontend  # ou backend
npm audit
npm audit fix
npm install package@latest
```

2. Commitez et poussez les changements:
```bash
git add package.json package-lock.json
git commit -m "fix: mise à jour des dépendances pour corriger les vulnérabilités"
git push
```

### Erreur: "Cannot connect to database"

**Cause**: Les variables d'environnement de la base de données ne sont pas correctement configurées.

**Solution**:
1. Vérifiez que PostgreSQL est ajouté comme service dans Railway
2. Utilisez les variables automatiques Railway:
```
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
```

3. Vérifiez les logs: `railway logs`

### Erreur: "Port already in use" ou "EADDRINUSE"

**Cause**: L'application n'utilise pas la variable PORT fournie par Railway.

**Solution**:
1. Vérifiez que votre application utilise `process.env.PORT`:
```typescript
const port = process.env.PORT || 3001;
await app.listen(port, '0.0.0.0');
```

2. Railway définit automatiquement `PORT`, votre application doit l'utiliser.

### Erreur: "Build timeout"

**Cause**: Le build prend trop de temps (> 10 minutes).

**Solution**:
1. Optimisez le Dockerfile avec des layers de cache:
```dockerfile
# Copier d'abord les dépendances
COPY package*.json ./
RUN npm ci

# Puis copier le code source
COPY . .
RUN npm run build
```

2. Utilisez `.dockerignore` pour exclure les fichiers inutiles

### Erreur: "Module not found" après déploiement

**Cause**: Les dépendances ne sont pas installées correctement ou le build échoue.

**Solution**:
1. Vérifiez que `npm ci` est utilisé (pas `npm install`)
2. Vérifiez que `package-lock.json` est commité
3. Vérifiez les logs de build: `railway logs --build`

### Erreur: "Migration failed"

**Cause**: Les migrations de base de données n'ont pas été exécutées.

**Solution**:
1. Exécutez les migrations via Railway CLI:
```bash
railway run npm run migration:run
```

2. Ou via le shell Railway dans le dashboard

### Erreur: "CORS policy"

**Cause**: Le backend bloque les requêtes du frontend.

**Solution**:
1. Configurez CORS dans le backend pour accepter l'URL du frontend:
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'https://votre-frontend.up.railway.app',
  credentials: true,
});
```

2. Ajoutez `FRONTEND_URL` dans les variables d'environnement Railway

## Commandes utiles Railway CLI

```bash
# Installer Railway CLI
npm i -g @railway/cli

# Se connecter
railway login

# Lier le projet
railway link

# Voir les logs
railway logs

# Voir les logs de build
railway logs --build

# Ouvrir un shell
railway shell

# Voir les variables d'environnement
railway variables

# Redémarrer le service
railway restart

# Exécuter une commande
railway run npm run migration:run
```

## Vérification du déploiement

1. **Vérifier que le build réussit**:
   - Allez dans Railway Dashboard → Deployments
   - Vérifiez que le build est vert (succès)

2. **Vérifier que l'application démarre**:
   - Vérifiez les logs: `railway logs`
   - Cherchez "Application démarrée" ou "Listening on port"

3. **Vérifier la connexion à la base de données**:
   - Vérifiez les logs pour les erreurs de connexion
   - Testez l'API: `curl https://votre-backend.up.railway.app/api`

4. **Vérifier les endpoints**:
   - Visitez `https://votre-backend.up.railway.app/api` (Swagger)
   - Testez quelques endpoints

## Support

- Documentation Railway: https://docs.railway.app/
- Support Railway: https://railway.app/support
- Discord Railway: https://discord.gg/railway

