# Dépannage : Erreur "Forbidden resource" (403) lors de la création d'utilisateur

## Problème

Vous obtenez une erreur **"Forbidden resource"** (403) lorsque vous essayez de créer un utilisateur MCZ (ou tout autre utilisateur) via l'interface web.

## Causes possibles

### 1. ❌ Vous n'êtes pas connecté en tant que SuperAdmin

**Solution** :
1. Vérifiez votre rôle actuel dans le menu latéral (en bas à gauche)
2. Si vous n'êtes pas SuperAdmin, déconnectez-vous
3. Reconnectez-vous avec les identifiants SuperAdmin

### 2. ❌ Votre token d'authentification a expiré

**Solution** :
1. Déconnectez-vous complètement
2. Reconnectez-vous avec vos identifiants SuperAdmin
3. Réessayez de créer l'utilisateur

### 3. ❌ Le token n'est pas correctement envoyé

**Vérification** :
1. Ouvrez la console du navigateur (F12)
2. Allez dans l'onglet "Network" (Réseau)
3. Essayez de créer un utilisateur
4. Cliquez sur la requête `POST /users`
5. Vérifiez l'onglet "Headers" → "Request Headers"
6. Vous devriez voir : `Authorization: Bearer votre_token`

**Si le token est absent** :
- Déconnectez-vous et reconnectez-vous
- Vérifiez que `localStorage.getItem('access_token')` retourne bien un token dans la console

## Solutions étape par étape

### Solution 1 : Vérifier votre connexion

```javascript
// Dans la console du navigateur (F12)
// Vérifiez votre token
localStorage.getItem('access_token')

// Vérifiez votre utilisateur
JSON.parse(localStorage.getItem('auth_user'))
```

**Si le token ou l'utilisateur est null** :
- Déconnectez-vous et reconnectez-vous

### Solution 2 : Créer l'utilisateur via l'API directement

Si l'interface web ne fonctionne pas, utilisez cURL ou Swagger :

#### Via cURL (PowerShell)

```powershell
# 1. Se connecter en SuperAdmin
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "username": "superadmin",
    "password": "VotreMotDePasse"
  }'

$token = $loginResponse.access_token
Write-Host "Token obtenu: $token"

# 2. Créer l'utilisateur MCZ
$userData = @{
    username = "mcz_zone1"
    password = "MotDePasseSecurise123!"
    email = "mcz.zone1@example.com"
    fullName = "Dr. MCZ Zone 1"
    role = "MCZ"
    scope = "ZONE"
    zoneId = "Mumbunda"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "http://localhost:3001/users" `
      -Method POST `
      -ContentType "application/json" `
      -Headers @{ Authorization = "Bearer $token" } `
      -Body $userData
    
    Write-Host "Utilisateur créé avec succès: $($result.username)" -ForegroundColor Green
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Détails: $($_.ErrorDetails.Message)" -ForegroundColor Red
}
```

#### Via Swagger UI

1. Accédez à : `http://localhost:3001/api`
2. Connectez-vous avec `POST /auth/login`
3. Copiez le `access_token`
4. Cliquez sur **"Authorize"** en haut à droite
5. Entrez : `Bearer votre_token`
6. Cliquez sur "Authorize" puis "Close"
7. Utilisez `POST /users` pour créer l'utilisateur

### Solution 3 : Vérifier les permissions backend

Vérifiez que l'endpoint `/users` nécessite bien le rôle SuperAdmin :

```typescript
// backend/src/users/users.controller.ts
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)  // ← Doit être présent
create(@Body() createUserDto: CreateUserDto) {
  return this.usersService.create(createUserDto);
}
```

## Vérifications à faire

### ✅ Checklist

- [ ] Vous êtes connecté en tant que **SuperAdmin**
- [ ] Votre token n'a pas expiré (reconnectez-vous si nécessaire)
- [ ] Le champ **zoneId** est rempli si vous créez un MCZ
- [ ] Le **scope** est bien **ZONE** pour un MCZ
- [ ] Le **rôle** est bien **MCZ**
- [ ] Tous les champs obligatoires sont remplis (username, password, email, fullName)

### 🔍 Vérification dans la console

Ouvrez la console du navigateur (F12) et vérifiez :

1. **Token présent** :
```javascript
localStorage.getItem('access_token') // Doit retourner un token
```

2. **Utilisateur SuperAdmin** :
```javascript
JSON.parse(localStorage.getItem('auth_user')).role // Doit être "SUPERADMIN"
```

3. **Requête API** :
- Allez dans l'onglet "Network"
- Créez un utilisateur
- Vérifiez la requête `POST /users`
- Status doit être 201 (Created) et non 403 (Forbidden)

## Message d'erreur amélioré

J'ai amélioré le message d'erreur dans l'interface. Maintenant, si vous obtenez une erreur 403, vous verrez :

```
Accès refusé (403): [message détaillé]

Vérifiez que vous êtes connecté en tant que SuperAdmin 
et que votre session n'a pas expiré.
```

## Si le problème persiste

1. **Videz le cache du navigateur** :
   - Ctrl + Shift + Delete
   - Cochez "Cookies" et "Données de sites"
   - Cliquez sur "Effacer"

2. **Vérifiez les logs backend** :
   - Regardez la console du serveur backend
   - Cherchez les erreurs liées à l'authentification

3. **Testez avec un autre navigateur** :
   - Essayez Chrome, Firefox ou Edge
   - Vérifiez si le problème persiste

4. **Vérifiez la configuration backend** :
   - Assurez-vous que `JWT_SECRET` est bien configuré
   - Vérifiez que les guards d'authentification sont bien activés

## Contact

Si le problème persiste après avoir essayé toutes ces solutions, vérifiez :
- Les logs du serveur backend
- La configuration de l'authentification JWT
- Les permissions dans la base de données





