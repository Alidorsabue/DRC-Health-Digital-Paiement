# Guide: Déployer le Frontend sur Railway

## 🎯 Configuration du Service Frontend

### Étape 1: Créer un Nouveau Service Frontend

1. Dans votre projet Railway, cliquez sur **"+ New"**
2. Sélectionnez **"GitHub Repo"** → votre dépôt
3. Railway créera un nouveau service

### Étape 2: Configurer le Build

**IMPORTANT**: Configurez manuellement dans le dashboard Railway :

1. Allez dans votre service frontend → **Settings** (⚙️)
2. Dans **Settings → Build** :
   - **Builder**: `DOCKERFILE`
   - **Dockerfile Path**: `Dockerfile` (relatif au root directory)
   - **Root Directory**: `frontend` ⚠️ **TRÈS IMPORTANT**
   - **Build Command**: (laissez vide)

**Note**: Le Dockerfile à la racine a été renommé en `Dockerfile.backend` pour éviter les conflits. Railway devrait maintenant utiliser automatiquement `frontend/Dockerfile` quand Root Directory = `frontend`.

### Étape 3: Configurer le Deploy

Dans **Settings → Deploy** :
- **Start Command**: `npm start`
- **Restart Policy**: `ON_FAILURE`

### Étape 4: Variables d'Environnement

Dans **Settings → Variables**, ajoutez :

```
NEXT_PUBLIC_API_URL=https://votre-backend.up.railway.app
NODE_ENV=production
PORT=${{PORT}}
```

**Important**: Remplacez `https://votre-backend.up.railway.app` par l'URL réelle de votre backend Railway.

### Étape 5: Générer un Domaine

1. Dans **Settings → Networking**
2. Cliquez sur **"Generate Domain"**
3. Railway créera une URL comme: `https://votre-frontend.up.railway.app`

## 🔍 Vérification

### Vérifier que le Bon Dockerfile est Utilisé

Dans les logs de build, vous devriez voir :
```
Step 1/XX : FROM node:18-alpine AS builder
```

Et **PAS** de références à `backend/` dans les commandes COPY.

### Erreur: "COPY backend/src" dans les logs

Si vous voyez cette erreur, cela signifie que Railway utilise le mauvais Dockerfile (celui à la racine).

**Solution**:
1. Vérifiez que **Root Directory** est bien défini à `frontend`
2. Vérifiez que **Dockerfile Path** est `Dockerfile` (pas `frontend/Dockerfile`)
3. Redéployez

## 🐛 Dépannage

### Erreur: "package-lock.json not found"

Le Dockerfile du frontend utilise maintenant `npm install` au lieu de `npm ci`, donc cela devrait fonctionner.

### Erreur: "COPY backend/src" 

Railway utilise le mauvais Dockerfile. Vérifiez :
- **Root Directory** = `frontend`
- **Dockerfile Path** = `Dockerfile`

### Le Frontend ne se connecte pas au Backend

1. Vérifiez que `NEXT_PUBLIC_API_URL` est correctement configuré
2. Vérifiez que l'URL du backend est accessible
3. Vérifiez les CORS dans le backend (déjà configuré pour accepter le frontend)

## ✅ Checklist

- [ ] Service frontend créé dans Railway
- [ ] Root Directory = `frontend`
- [ ] Dockerfile Path = `Dockerfile`
- [ ] Variables d'environnement configurées
- [ ] `NEXT_PUBLIC_API_URL` pointe vers le backend
- [ ] Domaine généré
- [ ] Build réussi
- [ ] Application accessible via l'URL

## 📝 Note sur les Variables d'Environnement

Next.js nécessite que les variables d'environnement commençant par `NEXT_PUBLIC_` soient définies au moment du build, pas seulement au runtime.

Si vous changez `NEXT_PUBLIC_API_URL`, vous devrez redéployer pour que le changement prenne effet.

## 🆘 Support

Si le problème persiste :
1. Vérifiez les logs de build complets
2. Vérifiez que le Dockerfile du frontend est correct
3. Vérifiez la configuration dans Settings → Build

