# Configuration PostgreSQL 18 - Port 5433

## Configuration actuelle

Le fichier `.env` est configuré pour PostgreSQL 18 sur le port **5433** :

```env
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=drc_digit_payment
```

## Créer la base de données

Si la base de données n'existe pas encore, créez-la avec l'une des méthodes suivantes :

### Méthode 1 : Via pgAdmin ou DBeaver
Connectez-vous à PostgreSQL sur le port 5433 et exécutez :
```sql
CREATE DATABASE drc_digit_payment;
```

### Méthode 2 : Via ligne de commande (si psql est dans le PATH)
```bash
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE drc_digit_payment;"
```

### Méthode 3 : Via PowerShell (si psql est installé)
```powershell
$env:PGPASSWORD='postgres'
psql -h localhost -p 5433 -U postgres -c "CREATE DATABASE drc_digit_payment;"
```

## Vérifier la connexion

Une fois la base de données créée, le serveur NestJS créera automatiquement toutes les tables au démarrage (mode développement avec `synchronize: true`).

## Démarrer le serveur

```bash
cd backend
npm run start:dev
```

Le serveur devrait démarrer et se connecter à PostgreSQL sur le port 5433.

## En cas d'erreur de connexion

Si vous voyez une erreur de connexion, vérifiez :

1. **PostgreSQL est démarré** : Vérifiez que le service PostgreSQL est actif
2. **Port correct** : Confirmez que PostgreSQL écoute sur le port 5433
3. **Identifiants** : Vérifiez que `DB_USERNAME` et `DB_PASSWORD` sont corrects dans `.env`
4. **Base de données existe** : Assurez-vous que `drc_digit_payment` existe

## Tester la connexion manuellement

Vous pouvez tester la connexion avec Node.js :

```javascript
const { Client } = require('pg');
const client = new Client({
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'drc_digit_payment'
});

client.connect()
  .then(() => console.log('✓ Connexion réussie!'))
  .catch(err => console.error('✗ Erreur:', err));
```

