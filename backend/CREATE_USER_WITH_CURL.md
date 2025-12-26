# Créer un utilisateur avec cURL

## Problème : Erreur 401 Unauthorized

L'endpoint `POST /users` nécessite une authentification SuperAdmin. Vous devez d'abord vous connecter pour obtenir un token JWT.

## Solution en 2 étapes

### Étape 1 : Se connecter et obtenir un token

```bash
curl -X 'POST' \
  'http://localhost:3001/auth/login' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "username": "superadmin",
  "password": "VotreMotDePasse"
}'
```

**Réponse attendue** :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "superadmin",
    ...
  }
}
```

**Copiez le `access_token`** de la réponse.

### Étape 2 : Créer un utilisateur avec le token

```bash
curl -X 'POST' \
  'http://localhost:3001/users' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer VOTRE_TOKEN_ICI' \
  -d '{
  "username": "it_plateau1",
  "password": "plateau1@@",
  "email": "it.plateau1@example.com",
  "fullName": "Junior MBULU",
  "role": "IT",
  "scope": "AIRE",
  "provinceId": "Haut Katanga",
  "zoneId": "Mumbunda",
  "aireId": "Plateau 1"
}'
```

**Important** : Remplacez `VOTRE_TOKEN_ICI` par le token obtenu à l'étape 1.

## Exemple complet (PowerShell)

```powershell
# Étape 1 : Connexion
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "username": "superadmin",
    "password": "VotreMotDePasse"
  }'

# Récupérer le token
$token = $loginResponse.access_token

# Étape 2 : Créer un utilisateur
Invoke-RestMethod -Uri "http://localhost:3001/users" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{
    "username": "it_plateau1",
    "password": "plateau1@@",
    "email": "it.plateau1@example.com",
    "fullName": "Junior MBULU",
    "role": "IT",
    "scope": "AIRE",
    "provinceId": "Haut Katanga",
    "zoneId": "Mumbunda",
    "aireId": "Plateau 1"
  }'
```

## Votre requête corrigée

Voici votre requête curl corrigée avec l'en-tête Authorization :

```bash
# D'abord, obtenez le token (remplacez les identifiants)
TOKEN=$(curl -X 'POST' \
  'http://localhost:3001/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
  "username": "superadmin",
  "password": "VotreMotDePasse"
}' | jq -r '.access_token')

# Ensuite, créez l'utilisateur avec le token
curl -X 'POST' \
  'http://localhost:3001/users' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
  "username": "it_plateau1",
  "password": "plateau1@@",
  "email": "it.plateau1@example.com",
  "fullName": "Junior MBULU",
  "role": "IT",
  "scope": "AIRE",
  "provinceId": "Haut Katanga",
  "zoneId": "Mumbunda",
  "aireId": "Plateau 1"
}'
```

## Notes importantes

1. **Email valide** : Remplacez `"string"` par un email valide (ex: `"it.plateau1@example.com"`)
2. **partnerId** : Si vous créez un IT, vous pouvez omettre `partnerId` ou le mettre à `null`
3. **Token expiration** : Les tokens expirent après 7 jours (configuré dans `.env`). Si vous obtenez une erreur 401, reconnectez-vous.

## Valeurs enum valides

- **role** : `"IT"`, `"MCZ"`, `"DPS"`, `"NATIONAL"`, `"SUPERADMIN"`, `"PARTNER"`
- **scope** : `"AIRE"`, `"ZONE"`, `"PROVINCE"`, `"NATIONAL"`

## Alternative : Utiliser Swagger

1. Connectez-vous avec `POST /auth/login` dans Swagger
2. Copiez le `access_token`
3. Cliquez sur "Authorize" en haut de la page Swagger
4. Entrez : `Bearer votre_token`
5. Utilisez `POST /users` normalement

