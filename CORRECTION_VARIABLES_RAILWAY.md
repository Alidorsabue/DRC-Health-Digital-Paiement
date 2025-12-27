# Correction des Variables d'Environnement Railway

## ⚠️ Problèmes Détectés

### 1. Guillemets Autour des Références Railway

**❌ Incorrect** :
```
DB_HOST="${{Postgres.PGHOST}}"
```

**✅ Correct** :
```
DB_HOST=${{Postgres.PGHOST}}
```

Railway résout automatiquement les références `${{...}}`, mais les guillemets peuvent empêcher la résolution correcte.

### 2. Slash Final dans FRONTEND_URL

**❌ Incorrect** :
```
FRONTEND_URL="https://frontend-production-f810.up.railway.app/"
```

**✅ Correct** :
```
FRONTEND_URL=https://frontend-production-f810.up.railway.app
```

Le slash final peut causer des problèmes de CORS et de construction d'URL.

## ✅ Configuration Correcte

Dans Railway → Settings → Variables, configurez **SANS guillemets** :

```
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
JWT_SECRET=votre-secret-jwt-securise-changez-moi
JWT_EXPIRES_IN=7d
NODE_ENV=production
FRONTEND_URL=https://frontend-production-f810.up.railway.app
PORT=${{PORT}}
```

## 🔧 Comment Corriger

1. Allez dans Railway → Votre service backend → Settings → Variables
2. Pour chaque variable, **supprimez les guillemets** autour de la valeur
3. Pour `FRONTEND_URL`, **supprimez le slash final**
4. Sauvegardez
5. Redéployez le service (Railway redéploiera automatiquement)

## 📝 Notes Importantes

- **Ne mettez PAS de guillemets** autour des valeurs dans Railway
- Railway résout automatiquement `${{Postgres.XXX}}` et `${{PORT}}`
- Les guillemets sont traités comme partie de la valeur, ce qui peut casser la connexion

## 🧪 Vérification

Après correction, vérifiez dans les logs que :
- La connexion à la base de données fonctionne
- L'application démarre correctement
- Pas d'erreurs "Cannot connect to database"

