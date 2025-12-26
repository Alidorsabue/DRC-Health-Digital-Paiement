# Documentation API

## Authentification

### POST /auth/login
Connexion utilisateur

**Body:**
```json
{
  "username": "it_username",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "jwt_token",
  "user": {
    "id": "uuid",
    "username": "it_username",
    "role": "IT",
    "scope": "AIRE",
    "aireId": "aire_uuid"
  }
}
```

## Formulaires

### GET /forms
Liste tous les formulaires

### POST /forms
Créer un formulaire (SuperAdmin uniquement)

### POST /forms/:id/versions
Créer une nouvelle version du formulaire

## Campagnes

### GET /campaigns
Liste toutes les campagnes

### POST /campaigns
Créer une campagne (SuperAdmin uniquement)

## Prestataires

### POST /prestataires
Enregistrer un prestataire (IT uniquement)

### GET /prestataires
Liste des prestataires avec filtres (provinceId, zoneId, aireId, status)

## Validations

### POST /prestataires/:prestataireId/validation-it
Valider un prestataire (IT uniquement)

**Body:**
```json
{
  "joursPrestes": 5,
  "preuvePresence": "base64_image",
  "signaturePrestataire": "base64_signature",
  "validationData": {}
}
```

## Approbations

### GET /approbations?zoneId=xxx&status=VALIDE_PAR_IT
Liste des prestataires à approuver

### POST /approbations/prestataires/:prestataireId/approve
Approuver un prestataire (MCZ)

### POST /approbations/batch/approve
Approuver plusieurs prestataires en batch

## Mobile Sync

### POST /mobile/sync
Synchronisation bidirectionnelle (IT uniquement)

**Body:**
```json
{
  "downloadForms": true,
  "downloadCampaigns": true,
  "downloadPrestataires": true,
  "campaignId": "uuid",
  "uploadPrestataires": true,
  "prestataires": [...],
  "uploadValidations": true,
  "validations": [...]
}
```

## Partenaires

### GET /partner/prestataires?categories=OMS&campaignId=xxx
Obtenir les prestataires par catégories

### POST /partner/batches
Créer un lot de paiement

### POST /partner/payment-notification
Notifier le paiement via webhook HMAC

## Statistiques

### GET /stats/national
Statistiques nationales

### GET /stats/province/:id
Statistiques d'une province

### GET /stats/zone/:id
Statistiques d'une zone

### GET /stats/aire/:id
Statistiques d'une aire


