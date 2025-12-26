# Configuration Manuelle Railway - Guide Étape par Étape

Si Railway ne détecte pas automatiquement votre Dockerfile, suivez ce guide pour configurer manuellement.

## 📋 Configuration dans le Dashboard Railway

### Étape 1: Accéder aux paramètres du service

1. Connectez-vous à Railway: https://railway.app/
2. Sélectionnez votre projet
3. Cliquez sur votre service backend
4. Allez dans l'onglet **Settings** (⚙️)

### Étape 2: Configurer le Build

Dans la section **Build**, configurez :

1. **Build Command**: Laissez **VIDE** (Railway utilisera le Dockerfile)
2. **Root Directory**: Laissez **VIDE** ou mettez `.` (point = racine)
3. **Dockerfile Path**: `Dockerfile` (le Dockerfile est à la racine)
4. **Docker Build Context**: Laissez **VIDE** (utilise la racine par défaut)

### Étape 3: Configurer le Deploy

Dans la section **Deploy**, configurez :

1. **Start Command**: `node dist/main.js`
2. **Healthcheck Path**: (laissez vide)
3. **Restart Policy**: `ON_FAILURE`

### Étape 4: Vérifier les Variables d'Environnement

Dans l'onglet **Variables**, ajoutez :

```
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
JWT_SECRET=votre-secret-jwt-tres-securise-changez-moi
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=${{PORT}}
FRONTEND_URL=https://votre-frontend.up.railway.app
```

### Étape 5: Redéployer

1. Cliquez sur **Deploy** ou **Redeploy**
2. Attendez la fin du build
3. Vérifiez les logs pour confirmer que tout fonctionne

## 🔍 Vérification

### Vérifier que le Dockerfile est trouvé

Dans les logs de build, vous devriez voir :
```
Step 1/XX : FROM node:18-alpine AS builder
```

Si vous voyez une erreur "couldn't locate the dockerfile", vérifiez :
- Que le fichier `Dockerfile` existe à la racine du projet
- Que le fichier est commité dans Git
- Que le **Dockerfile Path** dans Railway est bien `Dockerfile`

### Vérifier que le build réussit

Dans les logs, cherchez :
```
Step XX/XX : RUN npm run build
```

Si le build échoue, vérifiez les erreurs dans les logs.

### Vérifier que l'application démarre

Dans les logs de déploiement, cherchez :
```
Application démarrée avec succès!
Listening on port XXXX
```

## 🐛 Dépannage

### Le Dockerfile n'est toujours pas trouvé

1. **Vérifiez que le fichier est commité**:
```bash
git status
git add Dockerfile
git commit -m "Add Dockerfile"
git push
```

2. **Vérifiez le nom du fichier**:
   - Le fichier doit s'appeler exactement `Dockerfile` (sans extension)
   - Pas `Dockerfile.txt` ou `dockerfile`

3. **Vérifiez dans Railway**:
   - Allez dans Settings → Build
   - Le **Dockerfile Path** doit être `Dockerfile` (pas `./Dockerfile` ou `Dockerfile.dockerfile`)

### Le build échoue avec "file not found"

Si vous voyez des erreurs comme "COPY failed: file not found", vérifiez :
- Que tous les fichiers du backend sont commités dans Git
- Que le `.dockerignore` n'exclut pas des fichiers nécessaires

### L'application ne démarre pas

1. Vérifiez les logs: `railway logs`
2. Vérifiez que toutes les variables d'environnement sont configurées
3. Vérifiez que PostgreSQL est démarré et accessible

## 📝 Alternative: Utiliser Nixpacks au lieu de Dockerfile

Si le Dockerfile continue de poser problème, Railway peut détecter automatiquement NestJS et utiliser Nixpacks:

1. Dans Settings → Build
2. Changez **Builder** de `DOCKERFILE` à `NIXPACKS`
3. Définissez **Root Directory** à `backend`
4. Railway détectera automatiquement NestJS et construira l'application

**Note**: Avec Nixpacks, vous n'avez pas besoin de Dockerfile, mais vous perdez le contrôle sur le processus de build.

## ✅ Checklist de Configuration

- [ ] Dockerfile existe à la racine du projet
- [ ] Dockerfile est commité dans Git
- [ ] Railway Settings → Build → Dockerfile Path = `Dockerfile`
- [ ] Railway Settings → Deploy → Start Command = `node dist/main.js`
- [ ] Variables d'environnement configurées
- [ ] PostgreSQL ajouté comme service
- [ ] Build réussi (vérifier les logs)
- [ ] Application démarre (vérifier les logs)

## 🆘 Besoin d'aide ?

Si le problème persiste :
1. Vérifiez les logs complets dans Railway
2. Partagez les erreurs spécifiques
3. Consultez la documentation Railway: https://docs.railway.app/

