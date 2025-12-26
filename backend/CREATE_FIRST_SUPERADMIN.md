# Créer le premier SuperAdmin

## Problème résolu

L'endpoint `POST /users` nécessitait une authentification SuperAdmin, mais pour créer le premier SuperAdmin, il fallait déjà être authentifié (problème de l'œuf et de la poule).

## Solution

Un nouvel endpoint public a été créé : **`POST /users/init-superadmin`**

Cet endpoint :
- ✅ Est **public** (pas besoin d'authentification)
- ✅ Vérifie qu'**aucun SuperAdmin n'existe déjà**
- ✅ Ne permet de créer **que des SuperAdmin**
- ✅ Devient **inutilisable** une fois le premier SuperAdmin créé

## Comment l'utiliser dans Swagger

1. **Ouvrez Swagger** : http://localhost:3001/api

2. **Trouvez l'endpoint** : Dans la section "Users", cherchez `POST /users/init-superadmin`

3. **Cliquez sur "Try it out"**

4. **Entrez les données** :
```json
{
  "username": "superadmin",
  "password": "VotreMotDePasseSecurise123!",
  "email": "admin@example.com",
  "fullName": "Super Admin",
  "role": "SUPERADMIN",
  "scope": "NATIONAL"
}
```

5. **Cliquez sur "Execute"**

6. **Résultat attendu** : Code 201 avec les données de l'utilisateur créé

## Après la création

Une fois le premier SuperAdmin créé :

1. **Connectez-vous** avec `POST /auth/login` :
```json
{
  "username": "superadmin",
  "password": "VotreMotDePasseSecurise123!"
}
```

2. **Copiez le `access_token`** retourné

3. **Autorisez-vous dans Swagger** :
   - Cliquez sur le bouton **"Authorize"** en haut de la page
   - Entrez : `Bearer votre_token` ou juste `votre_token`
   - Cliquez sur "Authorize" puis "Close"

4. **Utilisez l'endpoint normal** `POST /users` pour créer d'autres utilisateurs

## Sécurité

- ✅ L'endpoint `init-superadmin` ne fonctionne **qu'une seule fois**
- ✅ Si un SuperAdmin existe déjà, vous obtiendrez une erreur 403 Forbidden
- ✅ Vous ne pouvez créer que des SuperAdmin avec cet endpoint
- ✅ Après la création, utilisez toujours l'endpoint authentifié `POST /users`

## En cas d'erreur

Si vous obtenez une erreur 403 "Un SuperAdmin existe déjà" :
- C'est normal, l'endpoint ne peut être utilisé qu'une seule fois
- Utilisez `POST /auth/login` pour vous connecter
- Puis utilisez `POST /users` avec authentification

