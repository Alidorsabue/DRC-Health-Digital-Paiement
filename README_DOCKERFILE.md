# Explication des Dockerfiles

Ce projet contient plusieurs Dockerfiles pour différents services :

## 📁 Structure des Dockerfiles

- **`Dockerfile.backend`** (à la racine) - Pour le backend NestJS
- **`frontend/Dockerfile`** - Pour le frontend Next.js
- **`backend/Dockerfile`** - Dockerfile original du backend (non utilisé sur Railway)

## 🚀 Utilisation sur Railway

### Backend
- Railway utilise `Dockerfile.backend` à la racine
- Root Directory: (vide ou `.`)
- Dockerfile Path: `Dockerfile.backend`

### Frontend
- Railway utilise `frontend/Dockerfile`
- Root Directory: `frontend`
- Dockerfile Path: `Dockerfile`

## ⚠️ Important

Le fichier `Dockerfile.backend` a été renommé depuis `Dockerfile` pour éviter que Railway le détecte automatiquement pour le frontend.

Si vous voulez utiliser le Dockerfile à la racine pour le backend, configurez Railway avec :
- Dockerfile Path: `Dockerfile.backend`

