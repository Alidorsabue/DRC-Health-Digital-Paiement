# Explication: Architecture et Base de Données

## 🔍 Comment ça fonctionne

### Architecture en 3 couches

```
┌─────────────┐
│  Frontend  │ (Next.js sur Railway)
│  (Web)     │
└──────┬──────┘
       │ HTTP/API
       │ (NEXT_PUBLIC_API_URL)
       ▼
┌─────────────┐
│   Backend   │ (NestJS sur Railway)
│   (API)     │
└──────┬──────┘
       │ SQL
       │ (DB_HOST, DB_PORT, etc.)
       ▼
┌─────────────┐
│ PostgreSQL  │ (Base de données sur Railway)
│   (DB)      │
└─────────────┘
```

### Flux de données

1. **Frontend** → Appelle le **Backend** via HTTP (API REST)
2. **Backend** → Se connecte à **PostgreSQL** via SQL
3. **PostgreSQL** → Stocke les données

**Le frontend ne se connecte JAMAIS directement à la base de données.**

## 📍 Sur quelle base de données tourne le frontend ?

### Réponse courte
Le frontend ne se connecte pas à une base de données. Il se connecte au backend via l'API.

### Configuration actuelle

Le frontend utilise cette configuration (dans `frontend/src/lib/api.ts`) :
```typescript
baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
```

**Si vous êtes sur Railway** :
- Le frontend utilise la variable d'environnement `NEXT_PUBLIC_API_URL`
- Cette variable doit pointer vers votre backend Railway
- Exemple : `NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app`

**Si `NEXT_PUBLIC_API_URL` n'est pas définie** :
- Le frontend utilise `http://localhost:3001` par défaut
- Cela signifie qu'il essaie de se connecter à un backend local (sur votre machine)
- Si vous n'avez pas de backend local qui tourne, les requêtes échoueront

## 🗄️ Sur quelle base de données tourne le backend ?

Le backend se connecte à PostgreSQL sur Railway via les variables d'environnement :
- `DB_HOST=${{Postgres.PGHOST}}`
- `DB_PORT=${{Postgres.PGPORT}}`
- `DB_USERNAME=${{Postgres.PGUSER}}`
- `DB_PASSWORD=${{Postgres.PGPASSWORD}}`
- `DB_NAME=${{Postgres.PGDATABASE}}`

**C'est la base de données PostgreSQL que vous voyez dans Railway** (celle qui est vide actuellement).

## ⚠️ Pourquoi la base de données est vide ?

La base de données PostgreSQL sur Railway est vide car **les migrations n'ont pas encore été exécutées**.

Les migrations sont des scripts SQL qui créent les tables nécessaires à l'application.

## ✅ Solution : Exécuter les Migrations

Vous devez exécuter les migrations pour créer les tables dans PostgreSQL.

### Méthode rapide : Railway CLI

```bash
# 1. Installer Railway CLI (si pas déjà fait)
npm i -g @railway/cli

# 2. Se connecter
railway login

# 3. Lier le projet
railway link
# Sélectionnez votre projet et service backend

# 4. Exécuter les migrations
cd backend
railway run npm run migration:run
```

### Vérifier après les migrations

1. Allez dans Railway → Votre service PostgreSQL
2. Cliquez sur **Database** → **Data**
3. Vous devriez voir les tables créées (users, prestataires, forms, etc.)

## 🔧 Vérifier la Configuration du Frontend

### Dans Railway Dashboard

1. Allez dans votre service **frontend**
2. Cliquez sur **Settings** → **Variables**
3. Vérifiez que vous avez :
   ```
   NEXT_PUBLIC_API_URL=https://drc-health-digital-paiement-production.up.railway.app
   ```

**Si cette variable n'existe pas**, ajoutez-la avec l'URL de votre backend Railway.

## 📋 Checklist

- [ ] Frontend configuré avec `NEXT_PUBLIC_API_URL` pointant vers le backend Railway
- [ ] Backend configuré avec les variables PostgreSQL (`${{Postgres.XXX}}`)
- [ ] Migrations exécutées (base de données n'est plus vide)
- [ ] Tables créées dans PostgreSQL
- [ ] Frontend peut se connecter au backend
- [ ] Backend peut se connecter à PostgreSQL

## 🆘 Dépannage

### Le frontend ne peut pas se connecter au backend

1. Vérifiez `NEXT_PUBLIC_API_URL` dans Railway
2. Vérifiez que le backend est démarré (logs Railway)
3. Vérifiez les erreurs CORS dans la console du navigateur

### Le backend ne peut pas se connecter à PostgreSQL

1. Vérifiez que PostgreSQL est "Active" dans Railway
2. Vérifiez les variables d'environnement (`DB_HOST`, `DB_PORT`, etc.)
3. Vérifiez les logs du backend pour les erreurs de connexion

### La base de données est toujours vide après les migrations

1. Vérifiez les logs des migrations : `railway logs`
2. Vérifiez qu'il n'y a pas d'erreurs
3. Vérifiez que les migrations existent dans `backend/migrations/`

