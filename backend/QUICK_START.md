# Guide de démarrage rapide

## Fichier .env créé

Le fichier `.env` a été créé avec les configurations par défaut. **Important :** Modifiez les valeurs suivantes selon votre environnement :

### Configuration de la base de données

Assurez-vous que PostgreSQL est installé et démarré, puis modifiez dans `.env` :

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=votre_utilisateur_postgres
DB_PASSWORD=votre_mot_de_passe_postgres
DB_NAME=drc_digit_payment
```

### Créer la base de données

```sql
CREATE DATABASE drc_digit_payment;
```

Ou via la ligne de commande :

```bash
createdb drc_digit_payment
```

## Démarrer le serveur

Le serveur devrait déjà être en cours d'exécution. Si ce n'est pas le cas :

```bash
npm run start:dev
```

## Accéder à l'API

- **API** : http://localhost:3001
- **Documentation Swagger** : http://localhost:3001/api

## Prochaines étapes

1. Vérifier que PostgreSQL est démarré
2. Créer la base de données `drc_digit_payment`
3. Le serveur créera automatiquement les tables au démarrage (mode développement)
4. Accéder à Swagger pour tester les endpoints

## Créer le premier utilisateur SuperAdmin

Une fois le serveur démarré, vous pouvez créer un SuperAdmin via l'API Swagger ou avec curl :

```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "username": "superadmin",
    "password": "SecurePassword123!",
    "email": "admin@example.com",
    "fullName": "Super Admin",
    "role": "SUPERADMIN",
    "scope": "NATIONAL"
  }'
```

**Note :** Pour créer le premier SuperAdmin, vous devrez peut-être temporairement modifier les guards dans `users.controller.ts`.

