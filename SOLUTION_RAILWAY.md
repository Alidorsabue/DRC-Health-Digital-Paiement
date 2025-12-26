# Solution Complète pour Railway - DRC Digit Payment

## 🎯 Problème Identifié

Railway a des difficultés à trouver le Dockerfile dans les sous-dossiers. Voici **3 solutions** pour résoudre ce problème.

## ✅ Solution 1: Configuration Manuelle dans Railway (RECOMMANDÉE)

### Étape 1: Dans le Dashboard Railway

1. Allez dans votre projet Railway
2. Cliquez sur votre service backend
3. Allez dans **Settings** (⚙️)

### Étape 2: Configuration Build

Dans **Settings → Build**:

```
Builder: DOCKERFILE
Dockerfile Path: Dockerfile
Root Directory: (LAISSEZ VIDE ou mettez ".")
```

**IMPORTANT**: Ne mettez PAS `backend/Dockerfile` dans Dockerfile Path. Le Dockerfile est maintenant à la racine.

### Étape 3: Configuration Deploy

Dans **Settings → Deploy**:

```
Start Command: node dist/main.js
```

### Étape 4: Variables d'Environnement

Dans **Variables**, ajoutez:

```
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
JWT_SECRET=votre-secret-jwt-securise
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=${{PORT}}
FRONTEND_URL=https://votre-frontend.up.railway.app
```

### Étape 5: Redéployer

1. Cliquez sur **Deploy** ou **Redeploy**
2. Vérifiez les logs

## ✅ Solution 2: Utiliser Nixpacks (Plus Simple)

Si le Dockerfile continue de poser problème, utilisez Nixpacks qui détecte automatiquement NestJS:

### Configuration

1. Dans **Settings → Build**:
   - **Builder**: `NIXPACKS`
   - **Root Directory**: `backend`
   - **Build Command**: (laissez vide)

2. Dans **Settings → Deploy**:
   - **Start Command**: `npm run start:prod`

3. Variables d'environnement: (même chose que Solution 1)

**Avantage**: Pas besoin de Dockerfile, Railway détecte automatiquement NestJS.

## ✅ Solution 3: Vérifier que le Dockerfile est bien commité

### Vérification Git

```bash
# Vérifier que Dockerfile est dans Git
git status
git ls-files | grep Dockerfile

# Si Dockerfile n'est pas dans Git:
git add Dockerfile
git commit -m "Add Dockerfile for Railway"
git push
```

### Vérification Locale

Assurez-vous que le fichier `Dockerfile` existe à la racine:
```bash
ls -la Dockerfile
```

Le fichier doit s'appeler exactement `Dockerfile` (sans extension, avec D majuscule).

## 🔍 Diagnostic

### Vérifier les Logs Railway

1. Allez dans votre service → **Deployments**
2. Cliquez sur le dernier déploiement
3. Regardez les **Build Logs**

### Erreurs Courantes

#### "couldn't locate the dockerfile"
- ✅ Vérifiez que `Dockerfile` existe à la racine
- ✅ Vérifiez que le fichier est commité dans Git
- ✅ Vérifiez **Dockerfile Path** dans Railway Settings = `Dockerfile`

#### "COPY failed: file not found"
- ✅ Vérifiez que tous les fichiers du backend sont commités
- ✅ Vérifiez que `.dockerignore` n'exclut pas des fichiers nécessaires

#### "npm ci failed"
- ✅ Vérifiez que `package-lock.json` est commité
- ✅ Vérifiez que `package.json` est correct

## 📝 Checklist Complète

- [ ] Dockerfile existe à la racine (`/Dockerfile`)
- [ ] Dockerfile est commité dans Git
- [ ] Railway Settings → Build → Dockerfile Path = `Dockerfile`
- [ ] Railway Settings → Build → Root Directory = (vide ou `.`)
- [ ] Railway Settings → Deploy → Start Command = `node dist/main.js`
- [ ] Variables d'environnement configurées
- [ ] PostgreSQL ajouté comme service
- [ ] Build réussi (vérifier les logs)
- [ ] Application démarre (vérifier les logs)

## 🚀 Alternative Rapide: Nixpacks

Si vous voulez éviter les problèmes de Dockerfile, utilisez Nixpacks:

1. **Settings → Build → Builder**: `NIXPACKS`
2. **Settings → Build → Root Directory**: `backend`
3. **Settings → Deploy → Start Command**: `npm run start:prod`

Railway détectera automatiquement NestJS et construira l'application sans Dockerfile.

## 🆘 Support

Si le problème persiste après avoir essayé ces solutions:

1. Partagez les **logs de build** complets depuis Railway
2. Partagez une capture d'écran de vos **Settings → Build**
3. Vérifiez que le Dockerfile est bien dans votre dépôt GitHub

