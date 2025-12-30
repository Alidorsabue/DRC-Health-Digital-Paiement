# Vérifier et Créer un SuperAdmin

## 🔍 Problème

Vous recevez une erreur 401 lors de la tentative de connexion. Cela peut signifier qu'aucun utilisateur n'existe dans la base de données.

## ✅ Solution : Créer un SuperAdmin

### Option 1: Via l'API (Recommandé)

1. **Vérifiez que le backend fonctionne** :
   - Ouvrez : `https://drc-health-digital-paiement-production.up.railway.app/api`
   - Vous devriez voir la documentation Swagger

2. **Créez un SuperAdmin via l'endpoint** :
   - Dans Swagger, trouvez l'endpoint : `POST /users/init-superadmin`
   - Cliquez sur "Try it out"
   - Utilisez ce JSON :
   ```json
   {
     "username": "admin",
     "password": "Admin123!",
     "email": "admin@example.com",
     "role": "SUPERADMIN"
   }
   ```
   - Cliquez sur "Execute"
   - Notez les identifiants créés

### Option 2: Via curl (Terminal)

```bash
curl -X POST https://drc-health-digital-paiement-production.up.railway.app/users/init-superadmin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin123!",
    "email": "admin@example.com",
    "role": "SUPERADMIN"
  }'
```

### Option 3: Via Railway CLI

```bash
railway run --service backend -- npm run migration:run
railway run --service backend -- node -e "
const axios = require('axios');
axios.post('http://localhost:3001/users/init-superadmin', {
  username: 'admin',
  password: 'Admin123!',
  email: 'admin@example.com',
  role: 'SUPERADMIN'
}).then(r => console.log('SuperAdmin créé:', r.data))
  .catch(e => console.error('Erreur:', e.response?.data || e.message));
"
```

## 🔐 Connexion

Après avoir créé le SuperAdmin, utilisez ces identifiants pour vous connecter :
- **Username** : `admin` (ou celui que vous avez choisi)
- **Password** : `Admin123!` (ou celui que vous avez choisi)

## ⚠️ Important

- Changez le mot de passe après la première connexion
- Ne partagez jamais les identifiants en production
- Créez des utilisateurs supplémentaires avec des rôles appropriés

## 🐛 Si ça ne fonctionne toujours pas

1. **Vérifiez les logs du backend** :
   - Railway → Service Backend → Logs
   - Cherchez des erreurs liées à la base de données

2. **Vérifiez que la base de données est initialisée** :
   - Railway → Service PostgreSQL → Data
   - Vérifiez qu'il y a une table `users`

3. **Vérifiez les variables d'environnement** :
   - Railway → Service Backend → Variables
   - Vérifiez que `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` sont correctes





