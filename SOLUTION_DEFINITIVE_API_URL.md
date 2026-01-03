# Solution Définitive : API URL dans le Frontend

## 🔍 Problème Identifié

Le frontend utilise toujours `http://localhost:3001` même après avoir configuré `NEXT_PUBLIC_API_URL` dans Railway.

## ⚠️ Cause Racine

Next.js compile les variables `NEXT_PUBLIC_*` **au moment du build**. Si la variable n'est pas disponible lors du build dans Railway, elle sera `undefined` dans le code compilé.

## ✅ Solution Multi-Niveaux

J'ai implémenté une solution à plusieurs niveaux :

### 1. Nettoyage des Guillemets
- Le code nettoie automatiquement les guillemets ajoutés par Railway
- Fonctionne même si Railway ajoute des guillemets automatiquement

### 2. Fallback Intelligent
- Si `NEXT_PUBLIC_API_URL` n'est pas disponible, le code détecte automatiquement si on est sur Railway
- Utilise l'URL du backend directement : `https://drc-health-digital-paiement-production.up.railway.app`

### 3. Logs de Debug
- Des logs détaillés permettent de voir exactement quelle URL est utilisée
- Aide à diagnostiquer les problèmes

## 🔧 Configuration dans Railway

### Option 1: Variable d'Environnement (Recommandé)

1. Railway → Service Frontend → Settings → Variables
2. Ajoutez :
   ```
   NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app
   ```
3. **Redéployez** le frontend (rebuild complet)

### Option 2: Fallback Automatique

Si la variable n'est pas configurée, le code détecte automatiquement Railway et utilise l'URL du backend.

## 📋 Vérification

Après déploiement, ouvrez la console du navigateur (F12) et cherchez :

```
🔍 DEBUG API CONFIG: {
  'API URL configurée': 'https://drc-health-digital-paiement-production.up.railway.app',
  'NEXT_PUBLIC_API_URL brute': '...',
  'NODE_ENV': 'production',
  'window.location.hostname': '...'
}
```

Et dans les requêtes réseau :
```
DEBUG API REQUEST: {
  baseURL: 'https://drc-health-digital-paiement-production.up.railway.app',
  ...
}
```

## 🆘 Si ça ne fonctionne toujours pas

1. **Vérifiez les logs du build** :
   - Railway → Service Frontend → Deployments → Build Logs
   - Cherchez des messages sur `NEXT_PUBLIC_API_URL`

2. **Vérifiez la console du navigateur** :
   - Ouvrez la console (F12)
   - Regardez les logs "🔍 DEBUG API CONFIG"
   - Partagez ces logs pour diagnostic

3. **Forcez un rebuild complet** :
   - Railway → Service Frontend → Deployments
   - Cliquez sur **Redeploy**
   - Attendez que le build se termine complètement

## 📝 Note Technique

Le code utilise maintenant :
1. `process.env.NEXT_PUBLIC_API_URL` (si disponible au build)
2. `window.__NEXT_DATA__.env.NEXT_PUBLIC_API_URL` (si disponible au runtime)
3. Détection automatique de Railway (fallback)

Cela garantit que l'URL sera correcte même si la variable n'est pas configurée correctement dans Railway.







