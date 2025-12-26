# Format JSON correct pour Swagger

## Erreur courante : "Expected double-quoted property name in JSON"

Cette erreur survient quand le JSON n'est pas correctement formaté dans Swagger.

## Format JSON correct pour créer un SuperAdmin

### Endpoint : `POST /users/init-superadmin`

**Copiez-collez ce JSON exactement tel quel** dans Swagger :

```json
{
  "username": "superadmin",
  "password": "Admin123!",
  "email": "admin@example.com",
  "fullName": "Super Admin",
  "role": "SUPERADMIN",
  "scope": "NATIONAL"
}
```

## Points importants

1. ✅ **Tous les noms de propriétés doivent être entre guillemets doubles** : `"username"` et non `username`
2. ✅ **Toutes les valeurs string doivent être entre guillemets doubles** : `"superadmin"` et non `superadmin`
3. ✅ **Pas de virgule après le dernier élément**
4. ✅ **Pas d'espaces avant les deux-points**
5. ✅ **Les valeurs enum doivent être exactement** : `"SUPERADMIN"` et `"NATIONAL"` (en majuscules)

## Valeurs enum valides

### Role (role)
- `"IT"`
- `"MCZ"`
- `"DPS"`
- `"NATIONAL"`
- `"SUPERADMIN"`
- `"PARTNER"`

### GeographicScope (scope)
- `"AIRE"`
- `"ZONE"`
- `"PROVINCE"`H
- `"NATIONAL"`

## Exemple complet avec tous les champs optionnels

```json
{
  "username": "superadmin",
  "password": "Admin123!",
  "email": "admin@example.com",
  "fullName": "Super Admin",
  "role": "SUPERADMIN",
  "scope": "NATIONAL",
  "provinceId": null,
  "zoneId": null,
  "aireId": null,
  "partnerId": null
}
```

**Note** : Les champs optionnels peuvent être omis complètement.

## Erreurs courantes à éviter

❌ **Mauvais** :
```json
{
  username: "superadmin",  // Pas de guillemets sur la propriété
  "password": 'Admin123!', // Guillemets simples au lieu de doubles
  "role": superadmin,      // Pas de guillemets sur la valeur string
  "scope": "national",      // Minuscules au lieu de majuscules
}
```

✅ **Bon** :
```json
{
  "username": "superadmin",
  "password": "Admin123!",
  "role": "SUPERADMIN",
  "scope": "NATIONAL"
}
```

## Vérification dans Swagger

1. Dans Swagger, cliquez sur "Try it out"
2. Effacez tout le contenu du champ JSON
3. Collez le JSON correct ci-dessus
4. Vérifiez qu'il n'y a pas de virgule après le dernier `}`
5. Cliquez sur "Execute"

## Si l'erreur persiste

1. Vérifiez qu'il n'y a pas de caractères invisibles (copiez depuis un éditeur de texte)
2. Utilisez un validateur JSON en ligne pour vérifier votre JSON
3. Assurez-vous que tous les guillemets sont droits (`"`) et non courbes (`"` ou `"`)

