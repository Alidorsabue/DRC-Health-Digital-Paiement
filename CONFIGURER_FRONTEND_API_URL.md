# Configurer l'URL de l'API dans le Frontend Railway

## 🎯 Problème

Le frontend pointe encore sur `http://localhost:3001` au lieu de votre backend Railway.

## ✅ Solution : Configurer la Variable d'Environnement

### Étape 1: Trouver l'URL de votre Backend Railway

1. Allez sur Railway: https://railway.app/
2. Sélectionnez votre projet
3. Cliquez sur votre **service backend**
4. Allez dans **Settings** → **Networking**
5. Copiez l'URL (exemple: `https://drc-health-digital-paiement-production.up.railway.app`)

### Étape 2: Configurer la Variable dans le Service Frontend

1. Allez sur Railway: https://railway.app/
2. Sélectionnez votre projet
3. Cliquez sur votre **service frontend**
4. Allez dans **Settings** → **Variables**
5. Cliquez sur **+ New Variable**
6. Ajoutez:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://drc-health-digital-paiement-production.up.railway.app` (remplacez par votre URL backend)
7. Cliquez sur **Add**

**⚠️ IMPORTANT**: 
- Ne mettez **PAS** de slash final (`/`) à la fin de l'URL
- Utilisez `https://` et non `http://`
- L'URL doit être accessible publiquement

### Étape 3: Redéployer le Frontend

Après avoir ajouté la variable, Railway redéploiera automatiquement le frontend.

### Étape 4: Vérifier

1. Ouvrez votre frontend déployé dans le navigateur
2. Ouvrez la console développeur (F12)
3. Allez dans l'onglet **Network**
4. Essayez de vous connecter ou de charger des données
5. Vérifiez que les requêtes pointent vers votre backend Railway (pas `localhost:3001`)

## 📋 Checklist

- [ ] URL du backend copiée depuis Railway
- [ ] Variable `NEXT_PUBLIC_API_URL` ajoutée dans le service frontend
- [ ] URL correcte (sans slash final, avec https://)
- [ ] Frontend redéployé
- [ ] Requêtes pointent vers le backend Railway (vérifié dans la console navigateur)

## 🔍 Vérification dans le Code

Le frontend utilise cette configuration dans `frontend/src/lib/api.ts`:

```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  // ...
});
```

Si `NEXT_PUBLIC_API_URL` n'est pas définie, il utilise `http://localhost:3001` par défaut.

## 🆘 Si ça ne fonctionne pas

1. **Vérifiez que la variable est bien définie**:
   - Railway → Service Frontend → Settings → Variables
   - Cherchez `NEXT_PUBLIC_API_URL`

2. **Vérifiez l'URL du backend**:
   - Testez l'URL dans votre navigateur: `https://votre-backend.up.railway.app/api`
   - Vous devriez voir la documentation Swagger

3. **Vérifiez les logs du frontend**:
   - Railway → Service Frontend → Deployments → Logs
   - Cherchez des erreurs de connexion

4. **Vérifiez la console du navigateur**:
   - Ouvrez la console (F12)
   - Regardez les erreurs CORS ou de connexion

## 📝 Note

Les variables d'environnement `NEXT_PUBLIC_*` sont exposées au client (navigateur). C'est normal et nécessaire pour que le frontend puisse se connecter à l'API.

