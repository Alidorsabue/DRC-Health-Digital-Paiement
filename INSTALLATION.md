# Guide d'Installation - DRC Digit Payment

## Prérequis

- Node.js 18+ et npm
- PostgreSQL 14+
- Flutter 3.0+ (pour l'application mobile)
- Git

## Installation Backend

1. Aller dans le dossier backend :
```bash
cd backend
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer la base de données :
   - Créer un fichier `.env` à la racine du dossier `backend/`
   - Copier le contenu suivant et adapter selon votre configuration :

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=drc_digit_payment

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

PARTNER_API_KEY=your-partner-api-key
WEBHOOK_SECRET=your-webhook-secret
```

4. Créer la base de données PostgreSQL :
```bash
createdb drc_digit_payment
```

5. Lancer les migrations (si configurées) ou laisser TypeORM créer les tables automatiquement en mode développement

6. Démarrer le serveur :
```bash
npm run start:dev
```

Le serveur sera accessible sur `http://localhost:3001`
La documentation Swagger sera disponible sur `http://localhost:3001/api`

## Installation Frontend

1. Aller dans le dossier frontend :
```bash
cd frontend
```

2. Installer les dépendances :
```bash
npm install
```

3. Créer un fichier `.env.local` :
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. Démarrer le serveur de développement :
```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## Installation Mobile (Flutter)

1. Aller dans le dossier mobile :
```bash
cd mobile
```

2. Installer les dépendances :
```bash
flutter pub get
```

3. Configurer l'URL de l'API dans le code (à faire dans les fichiers de configuration)

4. Lancer l'application :
```bash
flutter run
```

## Création du premier utilisateur SuperAdmin

Après avoir démarré le backend, vous pouvez créer un utilisateur SuperAdmin via l'API :

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

Note : Pour créer le premier SuperAdmin, vous devrez temporairement désactiver le guard de rôles ou utiliser une méthode alternative.

## Structure des dossiers

```
.
├── backend/          # API NestJS
│   ├── src/
│   │   ├── auth/     # Authentification
│   │   ├── users/    # Gestion utilisateurs
│   │   ├── forms/    # Formulaires dynamiques
│   │   ├── campaigns/# Campagnes
│   │   ├── prestataires/ # Prestataires
│   │   ├── validations/  # Validations IT
│   │   ├── approvals/   # Approbations MCZ
│   │   ├── payments/    # Paiements
│   │   ├── partners/    # API partenaires
│   │   ├── mobile/      # Sync mobile
│   │   └── stats/       # Statistiques
│   └── package.json
├── frontend/         # Application web Next.js
│   ├── src/
│   │   ├── app/      # Pages Next.js
│   │   └── lib/      # Utilitaires
│   └── package.json
├── mobile/           # Application Flutter
│   ├── lib/
│   └── pubspec.yaml
└── docs/             # Documentation
```

## Prochaines étapes

1. Configurer les variables d'environnement
2. Créer le premier utilisateur SuperAdmin
3. Créer une campagne de test
4. Créer des formulaires d'enregistrement et validation
5. Tester le workflow complet : Enregistrement → Validation → Approbation → Paiement

## Support

Pour toute question ou problème, consulter la documentation dans le dossier `docs/`.

