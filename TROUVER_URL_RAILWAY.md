# Comment Trouver l'URL de Votre Service Railway

Après un déploiement réussi sur Railway, voici comment trouver l'URL de votre application.

## 🌐 Méthode 1: Dashboard Railway (Le Plus Simple)

### Étape 1: Accéder au Service
1. Connectez-vous à Railway: https://railway.app/
2. Sélectionnez votre projet
3. Cliquez sur votre service backend

### Étape 2: Trouver l'URL
L'URL est affichée dans plusieurs endroits :

**Option A: Onglet "Settings"**
- Allez dans **Settings** (⚙️)
- Regardez la section **Networking** ou **Domains**
- Vous verrez l'URL générée automatiquement (ex: `https://votre-service-production.up.railway.app`)

**Option B: Onglet "Deployments"**
- Allez dans **Deployments**
- Cliquez sur le dernier déploiement (celui qui a réussi)
- L'URL est affichée en haut ou dans les détails

**Option C: Onglet "Metrics" ou "Logs"**
- Parfois l'URL est visible dans l'en-tête du service

### Étape 3: Générer un Domaine Personnalisé (Optionnel)
1. Dans **Settings → Networking**
2. Cliquez sur **Generate Domain** ou **Add Domain**
3. Railway générera une URL comme: `https://votre-service-production.up.railway.app`

## 🔧 Méthode 2: Railway CLI

Si vous avez Railway CLI installé :

```bash
# Installer Railway CLI (si pas déjà fait)
npm i -g @railway/cli

# Se connecter
railway login

# Lier votre projet
railway link

# Voir les informations du service
railway status

# Voir l'URL
railway domain
```

## 📋 Méthode 3: Vérifier les Variables d'Environnement

Railway expose automatiquement l'URL via une variable d'environnement :

1. Allez dans **Settings → Variables**
2. Cherchez `RAILWAY_PUBLIC_DOMAIN` ou `RAILWAY_DOMAIN`
3. Cette variable contient l'URL de votre service

## 🔍 Méthode 4: Vérifier les Logs

Parfois l'URL est affichée dans les logs :

1. Allez dans **Deployments**
2. Cliquez sur le dernier déploiement
3. Regardez les **Logs**
4. Cherchez des lignes comme :
   - `Server running on https://...`
   - `Application démarrée sur https://...`
   - `Listening on port...`

## ⚙️ Si Aucune URL n'Apparaît

### Vérifier que le Service est Public

1. Allez dans **Settings → Networking**
2. Vérifiez que **Public Networking** est activé
3. Si ce n'est pas le cas, activez-le

### Générer un Domaine Manuellement

1. Dans **Settings → Networking**
2. Cliquez sur **Generate Domain** ou **+ Add Domain**
3. Railway créera automatiquement un domaine public

### Vérifier le Port

Assurez-vous que votre application écoute sur le port fourni par Railway :

```typescript
// Dans backend/src/main.ts
const port = process.env.PORT || 3001;
await app.listen(port, '0.0.0.0');
```

Railway définit automatiquement la variable `PORT`.

## 🧪 Tester l'URL

Une fois que vous avez l'URL, testez-la :

### Test de Base
```bash
# Test simple
curl https://votre-service.up.railway.app

# Test avec l'endpoint Swagger
curl https://votre-service.up.railway.app/api
```

### Dans le Navigateur
1. Ouvrez votre navigateur
2. Allez sur: `https://votre-service.up.railway.app/api`
3. Vous devriez voir la documentation Swagger

## 📝 Format d'URL Railway

Les URLs Railway suivent généralement ce format :
- `https://[service-name]-[project-id].up.railway.app`
- Ou: `https://[custom-domain].railway.app`

## 🔐 Variables d'Environnement Utiles

Railway expose automatiquement ces variables :
- `PORT` - Le port sur lequel écouter
- `RAILWAY_ENVIRONMENT` - L'environnement (production, etc.)
- `RAILWAY_PUBLIC_DOMAIN` - Le domaine public (si configuré)

## 🆘 Problèmes Courants

### "No domain found"
- Allez dans **Settings → Networking**
- Cliquez sur **Generate Domain**

### "Service not responding"
- Vérifiez les logs pour voir si l'application démarre
- Vérifiez que le port est correctement configuré
- Vérifiez que `0.0.0.0` est utilisé (pas `localhost`)

### "Connection refused"
- L'application n'écoute peut-être pas sur le bon port
- Vérifiez que `process.env.PORT` est utilisé

## ✅ Checklist

- [ ] Service déployé avec succès (vérifier dans Deployments)
- [ ] Domaine généré dans Settings → Networking
- [ ] URL visible dans le dashboard
- [ ] Application écoute sur `0.0.0.0` et `process.env.PORT`
- [ ] Test de l'URL réussi

## 📚 Ressources

- Documentation Railway: https://docs.railway.app/
- Guide Networking: https://docs.railway.app/networking/domains

