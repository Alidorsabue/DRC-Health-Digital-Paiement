# Frontend - DRC Digit Payment

Interface web Next.js pour la plateforme de gestion des paiements des prestataires de santé publique.

## Installation

```bash
cd frontend
npm install
```

## Configuration

Créez un fichier `.env.local` à la racine du dossier `frontend/` :

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Démarrage

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## Structure

```
src/
├── app/
│   ├── login/              # Page de connexion
│   ├── dashboard/          # Dashboard principal
│   │   ├── layout.tsx      # Layout avec sidebar
│   │   ├── page.tsx        # Vue d'ensemble
│   │   ├── forms/          # Gestion des formulaires
│   │   │   ├── page.tsx    # Liste des formulaires
│   │   │   └── [id]/       # Éditeur de formulaire
│   │   ├── campaigns/      # Gestion des campagnes
│   │   ├── users/          # Gestion des utilisateurs
│   │   └── stats/          # Statistiques
│   └── page.tsx            # Page d'accueil (redirection)
├── components/
│   └── Layout/            # Sidebar, Header
├── hooks/
│   └── useAuth.ts         # Hook d'authentification
├── store/
│   └── authStore.ts       # Store Zustand pour l'auth
├── lib/
│   └── api/               # Clients API
└── types/
    └── index.ts           # Types TypeScript
```

## Fonctionnalités

### Authentification
- Page de login
- Gestion du token JWT
- Redirection automatique selon le rôle

### Dashboard SuperAdmin
- Vue d'ensemble avec statistiques
- Navigation sidebar
- Header avec profil utilisateur

### Gestion des formulaires
- Liste des formulaires
- Création de formulaires
- Éditeur de formulaire avec Form Builder
- Ajout de champs (texte, nombre, date, GPS, photo, signature)
- Gestion des versions
- Publication de versions

### Gestion des campagnes
- Liste des campagnes
- Création/modification
- Association de formulaires
- Activation/désactivation

### Gestion des utilisateurs
- Liste des utilisateurs
- Création/modification/suppression
- Gestion des rôles et scopes géographiques

### Statistiques
- Vue d'ensemble nationale
- Répartition par statut, province, catégorie

## Utilisation

1. **Connexion** : Accédez à `/login` et connectez-vous avec vos identifiants SuperAdmin
2. **Dashboard** : Après connexion, vous êtes redirigé vers le dashboard
3. **Navigation** : Utilisez la sidebar pour naviguer entre les différentes sections
4. **Form Builder** : Créez des formulaires dynamiques dans "Formulaires" → Créer → Éditer

## Technologies

- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Axios (HTTP client)

