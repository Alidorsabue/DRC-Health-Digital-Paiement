# Corriger les Variables d'Environnement Frontend

## ⚠️ Problème : Guillemets dans les Variables

Si vous avez configuré les variables avec des guillemets dans Railway :
```
NEXT_PUBLIC_API_URL="https://drc-health-digital-paiement-production.up.railway.app"
```

Railway peut traiter les guillemets comme partie de la valeur, ce qui donne :
```
"https://drc-health-digital-paiement-production.up.railway.app"
```

## ✅ Solution : Supprimer les Guillemets

### Dans Railway Dashboard

1. Allez dans Railway → Service Frontend → Settings → Variables
2. Pour chaque variable, **supprimez les guillemets** autour de la valeur
3. Les valeurs doivent être :

```
NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app
NODE_ENV=production
```

**SANS guillemets !**

### Vérification

Après correction, vérifiez que :
- Les valeurs n'ont pas de guillemets
- L'URL commence par `https://`
- L'URL ne se termine pas par `/`

## 🔄 Redéployer le Frontend

Après avoir corrigé les variables :

1. **Forcer un redéploiement** :
   - Railway → Service Frontend → Deployments
   - Cliquez sur **Redeploy** ou **Deploy Latest**

2. **Vérifier les logs** :
   - Regardez les logs du build
   - Cherchez des messages indiquant que les variables sont chargées

3. **Vérifier dans le navigateur** :
   - Ouvrez la console développeur (F12)
   - Dans la console, tapez : `console.log(process.env.NEXT_PUBLIC_API_URL)`
   - Vous devriez voir l'URL sans guillemets

## 🧪 Test Rapide

Dans la console du navigateur (F12), exécutez :

```javascript
// Vérifier l'URL de l'API
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

// Vérifier toutes les variables NEXT_PUBLIC_*
console.log('All NEXT_PUBLIC vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')));
```

## 📝 Note Importante sur Next.js

Les variables `NEXT_PUBLIC_*` sont **injectées au moment du build**, pas au runtime. Cela signifie :

1. Si vous ajoutez/modifiez `NEXT_PUBLIC_API_URL` après le build, vous devez **rebuild** l'application
2. Railway devrait automatiquement rebuilder quand vous modifiez les variables, mais parfois il faut forcer un redéploiement

## 🔍 Si ça ne fonctionne toujours pas

1. **Vérifiez que le build a bien utilisé les variables** :
   - Railway → Service Frontend → Deployments → Build Logs
   - Cherchez des messages sur les variables d'environnement

2. **Vérifiez dans le code compilé** :
   - Les variables `NEXT_PUBLIC_*` sont remplacées par leurs valeurs dans le code JavaScript compilé
   - Si vous voyez encore `localhost:3001` dans le code compilé, c'est que le build n'a pas pris les nouvelles variables

3. **Forcez un rebuild complet** :
   - Railway → Service Frontend → Settings → Build
   - Cliquez sur **Clear Build Cache** (si disponible)
   - Redéployez

4. **Vérifiez la configuration Next.js** :
   - Le fichier `next.config.js` devrait avoir :
   ```javascript
   env: {
     NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
   }
   ```

## 🆘 Solution Alternative : Vérifier dans Railway Dashboard

Si les variables ne fonctionnent toujours pas, vérifiez dans Railway :

1. Railway → Service Frontend → Settings → Variables
2. Vérifiez que les variables sont bien listées
3. Vérifiez qu'elles n'ont pas de guillemets dans la valeur
4. Si nécessaire, supprimez et recréez les variables





