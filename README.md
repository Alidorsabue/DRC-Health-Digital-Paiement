# DRC_Digit_payment

Plateforme nationale (mobile + web + backend) pour gérer l'enregistrement → validation → approbation → paiement des prestataires impliqués dans les activités de santé publique (Polio, Rougeole, Fièvre jaune, etc.).

## Architecture

- **Backend**: NestJS + PostgreSQL + TypeORM
- **Frontend Web**: Next.js + React + TypeScript
- **Mobile**: Flutter + SQLite (offline-first)

## Structure du projet

```
.
├── backend/          # API NestJS
├── frontend/         # Application web Next.js
├── mobile/           # Application Flutter
└── docs/             # Documentation

```

## Installation

### Backend

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Mobile

```bash
cd mobile
flutter pub get
flutter run
```

## Workflow

1. **Pré-campagne**: IT enregistre les prestataires via mobile
2. **Post-campagne**: IT valide les prestations (jours, preuve, signature)
3. **Approbation**: MCZ approuve/rejette les validations
4. **Paiement**: Partenaires extraient leurs catégories et notifient le paiement

## Rôles et permissions

- **IT (Infirmier Titulaire)**: Mobile, voit uniquement son Aire de Santé
- **MCZ (Médecin Chef de Zone)**: Web, voit sa Zone de Santé
- **DPS (Province)**: Web, lecture seule de sa province
- **National**: Web, lecture complète
- **SuperAdmin**: Web, gestion complète du système
- **Partenaires**: API sécurisée, lecture de leurs catégories uniquement

## 🚀 Déploiement sur Railway

Ce projet est configuré pour être déployé sur Railway (https://railway.com/).

### Guide rapide
Consultez `DEPLOYMENT_QUICK_START.md` pour un déploiement en 5 minutes.

### Documentation complète
- **Guide de déploiement**: `RAILWAY_DEPLOYMENT.md`
- **Build APK**: `mobile/BUILD_APK.md`

### Fichiers de configuration Railway
- `railway.toml` - Configuration Railway
- `backend/Dockerfile` - Image Docker pour le backend
- `frontend/Dockerfile` - Image Docker pour le frontend

## 📱 Build de l'APK Android

### Windows PowerShell
```powershell
.\mobile\build-apk.ps1
```

### Linux/macOS
```bash
chmod +x mobile/build-apk.sh
./mobile/build-apk.sh
```

L'APK sera généré dans: `mobile/build/app/outputs/flutter-apk/app-release.apk`

Pour plus de détails, consultez `mobile/BUILD_APK.md`

## ✅ Après le Déploiement

Si vous avez déployé sur Railway, consultez `APRES_DEPLOIEMENT.md` pour :
- Exécuter les migrations
- Créer le premier utilisateur
- Configurer l'application mobile
- Tester l'application

