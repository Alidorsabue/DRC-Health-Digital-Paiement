# Protection contre l'utilisation de localhost en production

## ✅ Modifications Appliquées

### 1. Détection Prioritaire de Railway (`frontend/src/utils/api-url.ts`)

Le code vérifie **EN PREMIER** si on est sur Railway en production :

```typescript
// Détecter si on est en production sur Railway
const isRailwayProduction = typeof window !== 'undefined' && 
  window.location.hostname !== 'localhost' && 
  window.location.hostname !== '127.0.0.1' &&
  window.location.hostname.includes('railway.app');

// En production sur Railway, TOUJOURS utiliser l'URL Railway
if (isRailwayProduction) {
  return 'https://drc-health-digital-paiement-production.up.railway.app';
}
```

**Résultat** : Si le frontend est déployé sur Railway, il utilise **TOUJOURS** l'URL Railway, **JAMAIS** localhost.

### 2. Protection de Sécurité dans l'Intercepteur (`frontend/src/lib/api.ts`)

Une vérification supplémentaire empêche l'utilisation de localhost en production :

```typescript
// Vérifier qu'on n'utilise jamais localhost en production sur Railway
const isRailwayProduction = typeof window !== 'undefined' && 
  window.location.hostname !== 'localhost' && 
  window.location.hostname !== '127.0.0.1' &&
  window.location.hostname.includes('railway.app');

if (isRailwayProduction && currentApiUrl.includes('localhost')) {
  const errorMsg = '❌ ERREUR CRITIQUE: Le frontend ne peut pas utiliser localhost en production sur Railway!';
  console.error(errorMsg);
  throw new Error(errorMsg);
}
```

**Résultat** : Si par erreur le code essaie d'utiliser localhost en production, une erreur est levée et le frontend ne fonctionne pas.

## 🔒 Garanties

1. **En production sur Railway** :
   - ✅ Utilise TOUJOURS `https://drc-health-digital-paiement-production.up.railway.app`
   - ❌ N'utilise JAMAIS localhost
   - ❌ Si l'URL Railway ne fonctionne pas, le frontend ne fonctionne pas (pas de fallback)

2. **En développement local** :
   - ✅ Utilise `http://localhost:3001` uniquement si le hostname est vraiment `localhost` ou `127.0.0.1`

## 📋 Comportement

### Scénario 1: Frontend déployé sur Railway
- Hostname: `drc-digital-paiement.up.railway.app`
- API URL utilisée: `https://drc-health-digital-paiement-production.up.railway.app`
- ✅ Fonctionne même si `NEXT_PUBLIC_API_URL` contient localhost

### Scénario 2: Frontend en développement local
- Hostname: `localhost` ou `127.0.0.1`
- API URL utilisée: `http://localhost:3001`
- ✅ Fonctionne normalement

### Scénario 3: URL Railway indisponible
- Le frontend essaie de se connecter à Railway
- Si Railway ne répond pas, les requêtes échouent
- ❌ Pas de fallback vers localhost
- ✅ Le frontend affiche les erreurs normalement

## 🚀 Test

Après redéploiement, dans la console du navigateur :

```
🔍 DEBUG API CONFIG: {
  'API URL configurée': 'https://drc-health-digital-paiement-production.up.railway.app',
  'window.location.hostname': 'drc-digital-paiement.up.railway.app',
  'isRailwayProduction': true
}
```

Et dans les requêtes :
```
DEBUG API REQUEST: {
  baseURL: 'https://drc-health-digital-paiement-production.up.railway.app',
  ...
}
```

## ⚠️ Important

- Le frontend ne fonctionnera **PAS** si l'URL Railway n'est pas disponible
- C'est un comportement voulu : pas de fallback vers localhost en production
- Si Railway est indisponible, corrigez le problème Railway au lieu d'utiliser localhost




