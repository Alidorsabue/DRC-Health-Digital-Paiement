# Guide de Déploiement sur Railway

Ce guide vous explique comment déployer votre application DRC Digit Payment sur Railway.

## 📋 Prérequis

1. Un compte Railway (https://railway.com/)
2. Un compte GitHub (pour connecter le dépôt)
3. PostgreSQL (Railway peut le fournir)

## 🚀 Déploiement du Backend

### Étape 1: Créer un nouveau projet sur Railway

1. Connectez-vous à Railway (https://railway.com/)
2. Cliquez sur "New Project"
3. Sélectionnez "Deploy from GitHub repo"
4. Autorisez Railway à accéder à votre dépôt GitHub
5. Sélectionnez votre dépôt

### Étape 2: Ajouter PostgreSQL

1. Dans votre projet Railway, cliquez sur "+ New"
2. Sélectionnez "Database" → "Add PostgreSQL"
3. Railway créera automatiquement une base de données PostgreSQL
4. Notez les variables d'environnement générées (elles seront automatiquement disponibles)

### Étape 3: Configurer le service Backend

1. Railway détectera automatiquement le Dockerfile dans `backend/Dockerfile`
2. Si ce n'est pas le cas, configurez manuellement :
   - **Root Directory**: `backend`
   - **Dockerfile Path**: `Dockerfile`

### Étape 4: Configurer les variables d'environnement

Dans les paramètres du service backend, ajoutez les variables suivantes :

```env
# Base de données (Railway génère automatiquement ces variables pour PostgreSQL)
# Utilisez les variables fournies par Railway : ${{Postgres.PGHOST}}, etc.
# Ou configurez manuellement :
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}

# JWT
JWT_SECRET=votre-secret-jwt-tres-securise-changez-moi
JWT_EXPIRES_IN=7d

# Port (Railway définit automatiquement PORT)
PORT=${{PORT}}

# Environnement
NODE_ENV=production

# Frontend URL (à mettre à jour après déploiement du frontend)
FRONTEND_URL=https://votre-frontend.up.railway.app

# API Keys (optionnel)
PARTNER_API_KEY=votre-partner-api-key
WEBHOOK_SECRET=votre-webhook-secret
```

**Note importante**: Railway fournit automatiquement les variables de connexion PostgreSQL avec le format `${{Postgres.VARIABLE_NAME}}`. Utilisez ces références plutôt que des valeurs en dur.

### Étape 5: Déployer

1. Railway déploiera automatiquement votre backend
2. Attendez que le build soit terminé
3. Railway vous fournira une URL publique (ex: `https://votre-backend.up.railway.app`)

### Étape 6: Exécuter les migrations

Après le premier déploiement, vous devrez exécuter les migrations de base de données. Vous pouvez le faire via Railway CLI :

```bash
# Installer Railway CLI
npm i -g @railway/cli

# Se connecter
railway login

# Lier votre projet
railway link

# Exécuter les migrations (depuis le dossier backend)
cd backend
railway run npm run migration:run
```

Ou via le terminal Railway dans le dashboard web.

## 🌐 Déploiement du Frontend

### Étape 1: Créer un nouveau service Frontend

1. Dans votre projet Railway, cliquez sur "+ New"
2. Sélectionnez "GitHub Repo"
3. Sélectionnez le même dépôt
4. Configurez :
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile`

### Étape 2: Configurer les variables d'environnement

```env
NEXT_PUBLIC_API_URL=https://votre-backend.up.railway.app
NODE_ENV=production
PORT=${{PORT}}
```

### Étape 3: Déployer

Railway déploiera automatiquement votre frontend et vous fournira une URL publique.

## 📱 Configuration de l'Application Mobile

Après le déploiement, mettez à jour l'URL de l'API dans votre application mobile :

1. Modifiez `mobile/lib/config/app_config.dart` :
```dart
static const String defaultApiUrl = 'https://votre-backend.up.railway.app';
```

2. Ou configurez l'URL via les préférences de l'application après l'installation.

## 🔧 Commandes utiles Railway CLI

```bash
# Voir les logs
railway logs

# Ouvrir un shell dans le conteneur
railway shell

# Voir les variables d'environnement
railway variables

# Redémarrer un service
railway restart
```

## 📝 Notes importantes

1. **Base de données**: Railway fournit PostgreSQL avec des variables d'environnement automatiques. Utilisez `${{Postgres.VARIABLE}}` pour référencer ces variables.

2. **Port**: Railway définit automatiquement la variable `PORT`. Votre application doit écouter sur ce port.

3. **HTTPS**: Railway fournit automatiquement HTTPS pour tous les services déployés.

4. **Variables d'environnement**: Utilisez le format `${{Service.Variable}}` pour référencer des variables d'autres services dans Railway.

5. **Builds**: Railway détecte automatiquement les changements dans votre dépôt GitHub et redéploie automatiquement.

6. **Logs**: Accédez aux logs via le dashboard Railway ou `railway logs`.

## 🐛 Dépannage

### Le backend ne démarre pas

- Vérifiez les logs : `railway logs`
- Vérifiez que toutes les variables d'environnement sont configurées
- Vérifiez que la base de données PostgreSQL est bien connectée

### Erreur de connexion à la base de données

- Vérifiez que vous utilisez les variables d'environnement Railway : `${{Postgres.PGHOST}}`
- Vérifiez que PostgreSQL est bien démarré dans Railway

### Le frontend ne peut pas se connecter au backend

- Vérifiez que `NEXT_PUBLIC_API_URL` pointe vers l'URL correcte du backend
- Vérifiez les CORS dans le backend (déjà configuré pour accepter le frontend)

## 🔐 Sécurité

- Changez `JWT_SECRET` par une valeur sécurisée et aléatoire
- Ne commitez jamais les fichiers `.env` dans Git
- Utilisez les variables d'environnement Railway pour tous les secrets

## 📚 Ressources

- Documentation Railway: https://docs.railway.app/
- Support Railway: https://railway.app/support

