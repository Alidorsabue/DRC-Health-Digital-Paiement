# Architecture de la Plateforme DRC Digit Payment

## Vue d'ensemble

La plateforme est composée de trois applications principales :
1. **Backend API** (NestJS + PostgreSQL)
2. **Application Web** (Next.js + React)
3. **Application Mobile** (Flutter)

## Backend (NestJS)

### Structure des modules

- **Auth** : Authentification JWT avec RBAC
- **Users** : Gestion des utilisateurs et permissions
- **Forms** : Formulaires dynamiques avec versioning
- **Campaigns** : Gestion des campagnes de santé publique
- **Prestataires** : Enregistrement des prestataires
- **Validations** : Validation IT des prestations
- **Approvals** : Approbation MCZ
- **Payments** : Suivi des paiements
- **Partners** : API pour partenaires (OMS, UNICEF)
- **Mobile** : Synchronisation offline-first
- **Stats** : Statistiques et monitoring

### Base de données

PostgreSQL avec TypeORM. Tables principales :
- `users` : Utilisateurs avec rôles et scopes géographiques
- `campaigns` : Campagnes de santé publique
- `forms` / `form_versions` : Formulaires dynamiques versionnés
- `prestataires` : Prestataires enregistrés
- `validations_it` : Validations par les IT
- `approvals_mcz` : Approbations par les MCZ
- `payments` : Suivi des paiements
- `audit_logs` : Logs d'audit immuables

### Workflow

1. **Pré-campagne** : IT enregistre les prestataires via mobile
2. **Post-campagne** : IT valide les prestations (jours, preuve, signature)
3. **Approbation** : MCZ approuve/rejette les validations
4. **Export** : Partenaires extraient leurs catégories
5. **Paiement** : Notification via webhook HMAC

## Frontend Web (Next.js)

### Rôles et interfaces

- **SuperAdmin** : Form builder, gestion campagnes, utilisateurs
- **MCZ** : Dashboard zone, approbations batch
- **DPS** : Dashboard province (lecture seule)
- **National** : Monitoring complet
- **Partenaires** : Téléchargement lots, historique paiements

## Mobile (Flutter)

### Fonctionnalités

- Mode offline-first avec SQLite
- Synchronisation bidirectionnelle intelligente
- Rendu dynamique des formulaires JSON Schema
- Capture signature, photo, GPS
- Gestion des formulaires d'enregistrement et validation

## Sécurité

- JWT avec expiration
- RBAC (Role-Based Access Control)
- Scopes géographiques (aire, zone, province, national)
- Webhook HMAC pour partenaires
- Audit logs immuables

