# Solution : Frontend pointe toujours sur localhost

## 🔍 Problème Identifié

Vous avez configuré :
```
NEXT_PUBLIC_API_URL="https://drc-health-digital-paiement-production.up.railway.app"
```

Mais le frontend utilise toujours `localhost:3001`.

## ⚠️ Causes Possibles

### 1. Guillemets dans les Variables

**❌ Incorrect** :
```
NEXT_PUBLIC_API_URL="https://drc-health-digital-paiement-production.up.railway.app"
```

**✅ Correct** :
```
NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app
```

Les guillemets peuvent être traités comme partie de la valeur par Railway.

### 2. Next.js compile les variables au Build Time

**IMPORTANT** : Next.js compile les variables `NEXT_PUBLIC_*` **au moment du build**, pas au runtime. Si vous ajoutez/modifiez ces variables après le build, vous devez **rebuild** l'application.

## ✅ Solution Complète

### Étape 1: Corriger les Variables dans Railway

1. Allez dans Railway → Service Frontend → Settings → Variables
2. **Supprimez les guillemets** autour des valeurs
3. Les variables doivent être :

```
NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app
NODE_ENV=production
```

**SANS guillemets !**

### Étape 2: Forcer un Redéploiement Complet

Après avoir corrigé les variables :

1. **Redéployer le service** :
   - Railway → Service Frontend → Deployments
   - Cliquez sur **Redeploy** ou **Deploy Latest**
   - Cela va rebuilder l'application avec les nouvelles variables

2. **Vérifier les logs du build** :
   - Railway → Service Frontend → Deployments → Build Logs
   - Cherchez des messages indiquant que les variables sont chargées

### Étape 3: Vérifier dans le Navigateur

1. Ouvrez votre frontend déployé
2. Ouvrez la console développeur (F12)
3. Dans la console, tapez :
```javascript
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

Vous devriez voir : `https://drc-health-digital-paiement-production.up.railway.app`

Si vous voyez `undefined` ou `http://localhost:3001`, c'est que :
- Les variables n'ont pas été prises en compte au build
- Il faut redéployer

### Étape 4: Vérifier les Requêtes Réseau

1. Ouvrez la console développeur (F12) → Network
2. Essayez de vous connecter ou de charger des données
3. Regardez les requêtes HTTP
4. L'URL de base devrait être `https://drc-health-digital-paiement-production.up.railway.app` (pas `localhost:3001`)

## 🔧 Solution Alternative : Vérifier dans Railway Dashboard

Si les variables ne fonctionnent toujours pas :

1. **Vérifiez que les variables sont bien définies** :
   - Railway → Service Frontend → Settings → Variables
   - Vérifiez que `NEXT_PUBLIC_API_URL` est bien listée
   - Vérifiez qu'elle n'a pas de guillemets dans la valeur

2. **Supprimez et recréez la variable** :
   - Supprimez `NEXT_PUBLIC_API_URL`
   - Recréez-la **sans guillemets**
   - Redéployez

3. **Vérifiez la configuration du build** :
   - Railway → Service Frontend → Settings → Build
   - Vérifiez que le Dockerfile est correctement configuré

## 📝 Note Importante

Les variables `NEXT_PUBLIC_*` dans Next.js sont :
- **Compilées dans le code JavaScript** au moment du build
- **Accessibles côté client** (navigateur)
- **Statiques** - elles ne changent pas après le build

C'est pourquoi vous devez **rebuild** l'application après avoir modifié ces variables.

## 🆘 Si Rien ne Fonctionne

1. **Vérifiez les logs du build** pour voir si les variables sont chargées
2. **Vérifiez le code compilé** dans `.next/` (si accessible)
3. **Contactez le support Railway** si le problème persiste

## ✅ Checklist Finale

- [ ] Variables configurées **sans guillemets** dans Railway
- [ ] Frontend redéployé (rebuild complet)
- [ ] Variables visibles dans la console navigateur
- [ ] Requêtes réseau pointent vers le backend Railway
- [ ] Pas d'erreurs CORS dans la console




