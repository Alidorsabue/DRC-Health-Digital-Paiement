# Guide d'accès en tant que MCZ (Médecin Chef de Zone)

## Méthode 1 : Via l'interface Web (Recommandé)

### Étape 1 : Se connecter en tant que SuperAdmin

1. Accédez à l'interface web : `http://localhost:3000` (ou votre URL frontend)
2. Connectez-vous avec vos identifiants SuperAdmin
3. Allez dans la section **"Utilisateurs"** dans le menu latéral

### Étape 2 : Créer un utilisateur MCZ

1. Cliquez sur le bouton **"Créer un utilisateur"**
2. Remplissez le formulaire avec les informations suivantes :

```json
{
  "username": "mcz_zone1",
  "password": "MotDePasseSecurise123!",
  "email": "mcz.zone1@example.com",
  "fullName": "Dr. MCZ Zone 1",
  "role": "MCZ",
  "scope": "ZONE",
  "zoneId": "VotreZoneId"  // Exemple: "Mumbunda", "Zone1", etc.
}
```

**Important pour MCZ** :
- **role** : `"MCZ"`
- **scope** : `"ZONE"` (obligatoire)
- **zoneId** : L'ID de la zone de santé (obligatoire)
- **provinceId** : Optionnel (sera déduit de la zone si nécessaire)
- **aireId** : Non requis (MCZ voit toutes les aires de sa zone)

### Étape 3 : Se connecter en tant que MCZ

1. Déconnectez-vous (ou ouvrez une fenêtre de navigation privée)
2. Connectez-vous avec les identifiants MCZ créés :
   - Username : `mcz_zone1`
   - Password : `MotDePasseSecurise123!`

### Étape 4 : Accéder à l'interface MCZ

Une fois connecté, vous verrez dans le menu latéral :
- **📊 Dashboard**
- **✅ Approbations MCZ** ← Cliquez ici
- **📈 Statistiques**

L'interface MCZ vous permet de :
- ✅ Voir la liste des prestataires validés par IT de votre zone
- ✅ Approuver/rejeter les prestataires (individuel ou en lot)
- ✅ Consulter le statut de paiement
- ✅ Filtrer par campagne et formulaire

---

## Méthode 2 : Via l'API (cURL ou Swagger)

### Étape 1 : Obtenir un token SuperAdmin

```bash
curl -X POST 'http://localhost:3001/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "superadmin",
    "password": "VotreMotDePasse"
  }'
```

Copiez le `access_token` de la réponse.

### Étape 2 : Créer l'utilisateur MCZ

```bash
curl -X POST 'http://localhost:3001/users' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer VOTRE_TOKEN_SUPERADMIN' \
  -d '{
    "username": "mcz_zone1",
    "password": "MotDePasseSecurise123!",
    "email": "mcz.zone1@example.com",
    "fullName": "Dr. MCZ Zone 1",
    "role": "MCZ",
    "scope": "ZONE",
    "zoneId": "Mumbunda"
  }'
```

### Étape 3 : Se connecter en tant que MCZ

```bash
curl -X POST 'http://localhost:3001/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "mcz_zone1",
    "password": "MotDePasseSecurise123!"
  }'
```

---

## Méthode 3 : Via Swagger UI

1. Accédez à Swagger : `http://localhost:3001/api`
2. Connectez-vous avec `POST /auth/login`
3. Copiez le token et cliquez sur **"Authorize"** en haut
4. Entrez : `Bearer votre_token`
5. Utilisez `POST /users` pour créer l'utilisateur MCZ

---

## Vérification des permissions MCZ

Une fois connecté en tant que MCZ, vous devez avoir :

✅ **Accès autorisé** :
- Dashboard
- Interface Approbations MCZ (`/dashboard/mcz`)
- Statistiques (limitées à sa zone)

❌ **Accès refusé** :
- Formulaires (SuperAdmin uniquement)
- Campagnes (SuperAdmin uniquement)
- Utilisateurs (SuperAdmin uniquement)
- Vue Province (DPS uniquement)
- Monitoring National (National/SuperAdmin uniquement)

---

## Exemple complet (PowerShell)

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

# 2. Créer un utilisateur MCZ
$mczUser = Invoke-RestMethod -Uri "http://localhost:3001/users" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body '{
    "username": "mcz_zone1",
    "password": "MotDePasseSecurise123!",
    "email": "mcz.zone1@example.com",
    "fullName": "Dr. MCZ Zone 1",
    "role": "MCZ",
    "scope": "ZONE",
    "zoneId": "Mumbunda"
  }'

Write-Host "Utilisateur MCZ créé : $($mczUser.username)"

# 3. Se connecter en tant que MCZ
$mczLogin = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "username": "mcz_zone1",
    "password": "MotDePasseSecurise123!"
  }'

Write-Host "Token MCZ : $($mczLogin.access_token)"
```

---

## Notes importantes

1. **zoneId requis** : Un MCZ doit avoir un `zoneId` défini pour voir les prestataires de sa zone
2. **Scope ZONE** : Le scope doit être `"ZONE"` (pas `"AIRE"` ni `"PROVINCE"`)
3. **Filtrage automatique** : L'interface MCZ filtre automatiquement les prestataires par la zone de l'utilisateur connecté
4. **Toutes les aires** : Un MCZ voit automatiquement tous les prestataires de toutes les aires de sa zone

---

## Dépannage

### Problème : "Accès non autorisé" sur `/dashboard/mcz`

**Solution** : Vérifiez que :
- L'utilisateur a bien le rôle `MCZ`
- L'utilisateur a un `zoneId` défini
- Le scope est bien `ZONE`

### Problème : Aucun prestataire visible

**Solution** : Vérifiez que :
- Des prestataires existent avec le statut `VALIDE_PAR_IT`
- Les prestataires ont le même `zoneId` que l'utilisateur MCZ
- Une campagne et un formulaire sont sélectionnés dans l'interface

### Problème : Erreur 401 lors de la création d'utilisateur

**Solution** : 
- Vérifiez que vous êtes bien connecté en SuperAdmin
- Vérifiez que le token n'a pas expiré (reconnectez-vous)
- Vérifiez l'en-tête Authorization : `Bearer votre_token`






