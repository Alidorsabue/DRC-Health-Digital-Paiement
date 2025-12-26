# Guide de Déploiement Rapide - Railway

## 🚀 Déploiement en 5 minutes

### Étape 1: Préparer votre dépôt GitHub

1. Assurez-vous que tous vos fichiers sont commités:
```bash
git add .
git commit -m "Préparation pour déploiement Railway"
git push
```

### Étape 2: Créer un compte Railway

1. Allez sur https://railway.com/
2. Cliquez sur "Start a New Project"
3. Connectez-vous avec GitHub

### Étape 3: Déployer le Backend

1. **Créer un nouveau projet**:
   - Cliquez sur "New Project"
   - Sélectionnez "Deploy from GitHub repo"
   - Choisissez votre dépôt

2. **Ajouter PostgreSQL**:
   - Cliquez sur "+ New"
   - Sélectionnez "Database" → "Add PostgreSQL"
   - Railway créera automatiquement une base de données

3. **Configurer le service Backend**:
   - Railway devrait détecter automatiquement le Dockerfile grâce à `railway.toml`
   - **IMPORTANT**: Si Railway ne trouve pas le Dockerfile, configurez manuellement dans le dashboard:
     - Allez dans votre service → Settings → Build
     - **Root Directory**: `backend`
     - **Dockerfile Path**: `Dockerfile` (relatif au root directory)
     - **Build Command**: (laissez vide, utilise le Dockerfile)
     - **Start Command**: `node dist/main.js`

4. **Configurer les variables d'environnement**:
   Cliquez sur votre service backend → Variables → Ajoutez:

   ```
   DB_HOST=${{Postgres.PGHOST}}
   DB_PORT=${{Postgres.PGPORT}}
   DB_USERNAME=${{Postgres.PGUSER}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   DB_NAME=${{Postgres.PGDATABASE}}
   JWT_SECRET=votre-secret-jwt-securise-changez-moi
   JWT_EXPIRES_IN=7d
   NODE_ENV=production
   FRONTEND_URL=https://votre-frontend.up.railway.app
   ```

5. **Déployer**:
   - Railway déploiera automatiquement
   - Attendez la fin du build
   - Notez l'URL fournie (ex: `https://votre-backend.up.railway.app`)

### Étape 4: Exécuter les migrations

Après le premier déploiement, exécutez les migrations:

**Option A: Via Railway Dashboard**
1. Allez dans votre service backend
2. Cliquez sur "Deployments" → "View Logs"
3. Cliquez sur "Shell"
4. Exécutez:
```bash
npm run migration:run
```

**Option B: Via Railway CLI**
```bash
npm i -g @railway/cli
railway login
railway link
cd backend
railway run npm run migration:run
```

### Étape 5: Déployer le Frontend (optionnel)

1. Dans votre projet Railway, cliquez sur "+ New"
2. Sélectionnez "GitHub Repo" → votre dépôt
3. Configurez:
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile`
4. Ajoutez les variables:
   ```
   NEXT_PUBLIC_API_URL=https://votre-backend.up.railway.app
   NODE_ENV=production
   ```
5. Déployez

### Étape 6: Mettre à jour l'application mobile

1. Ouvrez `mobile/lib/config/app_config.dart`
2. Modifiez l'URL de l'API:
```dart
static const String defaultApiUrl = 'https://votre-backend.up.railway.app';
```
3. Construisez l'APK (voir `mobile/BUILD_APK.md`)

## 📱 Build APK

### Windows PowerShell:
```powershell
.\mobile\build-apk.ps1
```

### Linux/macOS:
```bash
chmod +x mobile/build-apk.sh
./mobile/build-apk.sh
```

L'APK sera dans: `mobile/build/app/outputs/flutter-apk/app-release.apk`

## ✅ Vérification

1. **Backend**: Visitez `https://votre-backend.up.railway.app/api` (Swagger)
2. **Frontend**: Visitez l'URL fournie par Railway
3. **Mobile**: Installez l'APK sur un appareil Android

## 🔧 Commandes utiles

```bash
# Voir les logs
railway logs

# Ouvrir un shell
railway shell

# Voir les variables
railway variables

# Redémarrer
railway restart
```

## 📚 Documentation complète

- Guide détaillé: `RAILWAY_DEPLOYMENT.md`
- Build APK: `mobile/BUILD_APK.md`

## 🆘 Support

- Documentation Railway: https://docs.railway.app/
- Support Railway: https://railway.app/support

