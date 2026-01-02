# Correction des Références à Localhost dans le Frontend

## 🔍 Problème Identifié

Le frontend utilise toujours `http://localhost:3001` même quand il est déployé sur Railway (`drc-digital-paiement.up.railway.app`).

## ✅ Corrections Appliquées

### 1. Détection Améliorée de Localhost

Le fichier `frontend/src/utils/api-url.ts` a été modifié pour :

1. **Détecter localhost AVANT nettoyage** (ligne 19) :
   - Si `rawUrl` contient `localhost` ou est égal à `http://localhost:3001`
   - Détecte automatiquement Railway et utilise le fallback

2. **Détecter localhost APRÈS nettoyage** (ligne 42) :
   - Même si l'URL contient des guillemets qui masquent localhost
   - Après nettoyage, vérifie à nouveau et déclenche le fallback Railway

### 2. Fallback Automatique Railway

Si l'URL contient `localhost` ET que le frontend est déployé sur Railway :
- Détecte automatiquement `railway.app` dans le hostname
- Utilise automatiquement : `https://drc-health-digital-paiement-production.up.railway.app`

### 3. Vérification des Fichiers

Tous les fichiers du frontend utilisent déjà `api` qui utilise `getApiUrl()` :
- ✅ `frontend/src/lib/api.ts` - Utilise `getApiUrl()`
- ✅ `frontend/src/lib/api/forms.ts` - Utilise `api` (qui utilise `getApiUrl()`)
- ✅ `frontend/src/lib/api/campaigns.ts` - Utilise `api`
- ✅ `frontend/src/lib/api/auth.ts` - Utilise `api`
- ✅ Tous les autres fichiers API - Utilisent `api`

## 📋 Logique de Détection

```typescript
1. Si NEXT_PUBLIC_API_URL contient "localhost" → Fallback Railway
2. Si NEXT_PUBLIC_API_URL est vide → Fallback Railway
3. Après nettoyage, si l'URL contient "localhost" → Fallback Railway
4. Si hostname contient "railway.app" → Utilise l'URL Railway
5. Sinon → Utilise localhost (développement local uniquement)
```

## 🚀 Test

Après redéploiement, dans la console du navigateur, vous devriez voir :

```
🔍 DEBUG API CONFIG: {
  'API URL configurée': 'https://drc-health-digital-paiement-production.up.railway.app',
  'NEXT_PUBLIC_API_URL brute': 'http://localhost:3001',
  'NODE_ENV': 'production',
  'window.location.hostname': 'drc-digital-paiement.up.railway.app'
}
```

Et dans les requêtes :
```
DEBUG API REQUEST: {
  baseURL: 'https://drc-health-digital-paiement-production.up.railway.app',
  ...
}
```

## 📝 Notes

- Les références à `localhost` dans `frontend/next.config.js` et `frontend/README.md` sont normales (valeurs par défaut pour le développement local)
- Le code détecte automatiquement l'environnement et utilise la bonne URL
- Aucune configuration supplémentaire n'est nécessaire dans Railway






