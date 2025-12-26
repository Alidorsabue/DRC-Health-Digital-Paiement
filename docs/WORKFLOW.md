# Workflow Complet - DRC Digit Payment

## Vue d'ensemble du processus

Le système suit un workflow strict en plusieurs étapes pour garantir la traçabilité et la validation des paiements.

## 1. Pré-campagne (Mobile - IT)

### Enregistrement des prestataires

1. **IT télécharge le formulaire d'enregistrement**
   - Le SuperAdmin a créé et publié un formulaire d'enregistrement pour la campagne
   - L'IT synchronise son application mobile pour télécharger le formulaire

2. **IT enregistre les prestataires**
   - Pour chaque prestataire de son Aire de Santé, l'IT remplit le formulaire d'enregistrement
   - Les données sont stockées localement (SQLite) en mode offline
   - Les prestataires sont synchronisés vers le serveur

3. **Statut initial**
   - Tous les prestataires commencent avec le statut `ENREGISTRE`

## 2. Post-campagne (Mobile - IT)

### Validation des prestations

1. **IT reçoit la liste des prestataires enregistrés**
   - L'IT synchronise pour obtenir la liste des prestataires de sa campagne
   - Seuls les prestataires avec statut `ENREGISTRE` sont affichés

2. **Pour chaque prestataire, l'IT valide :**
   - **Nombre de jours prestés** : Doit être ≤ durée de la campagne
   - **Preuve de présence** : Photo ou document
   - **Signature du prestataire** : Obligatoire, capture sur écran tactile
   - **Données supplémentaires** : Selon le formulaire de validation

3. **Synchronisation**
   - Les validations sont stockées localement puis synchronisées
   - Le statut passe à `VALIDE_PAR_IT`

## 3. Approbation (Web - MCZ)

### Validation par le Médecin Chef de Zone

1. **MCZ consulte la liste des prestataires validés**
   - Le MCZ voit automatiquement tous les prestataires avec statut `VALIDE_PAR_IT` de sa Zone
   - Il peut filtrer par campagne, aire, catégorie

2. **Approbation individuelle ou batch**
   - **Approbation** : Statut passe à `APPROUVE_PAR_MCZ`
   - **Rejet** : Statut passe à `REJETE_PAR_MCZ` avec commentaire obligatoire
   - Possibilité d'approuver/rejeter plusieurs prestataires en une seule action

3. **Consultation du statut paiement**
   - Le MCZ peut voir si les prestataires approuvés ont été payés

## 4. Export Partenaire

### Extraction par catégories

1. **Partenaire (OMS, UNICEF, etc.) se connecte via API**
   - Authentification OAuth2 ou API Key
   - Accès en lecture seule

2. **Extraction des prestataires**
   - Le partenaire spécifie les catégories qu'il doit payer
   - Exemple : OMS = ["vaccinateur", "pointeur"]
   - Seuls les prestataires avec statut `APPROUVE_PAR_MCZ` sont retournés

3. **Création d'un lot (batch)**
   - Le partenaire crée un lot avec les IDs des prestataires sélectionnés
   - Un `batchId` unique est généré

## 5. Notification de paiement

### Webhook HMAC

1. **Partenaire notifie le paiement**
   - Envoi d'une requête POST avec signature HMAC
   - Le système vérifie la signature avant d'accepter

2. **Mise à jour du statut**
   - Statut passe à `SENT` (envoyé) ou `PAID` (payé)
   - En cas d'échec : `FAILED`
   - Transaction ID et référence de paiement sont enregistrés

## 6. Suivi et monitoring

### Niveaux d'accès

- **DPS (Province)** : Lecture seule de toutes les données de sa province
- **National** : Accès complet en lecture de toutes les provinces
- **SuperAdmin** : Accès complet + gestion du système

### Statistiques disponibles

- Nombre total de prestataires par statut
- Répartition par province/zone/aire
- Répartition par catégorie
- Taux d'approbation/rejet
- Statut des paiements

## Contrôles et validations

### Validations métier

1. **IT ne peut enregistrer que dans son Aire**
2. **Jours prestés ≤ durée campagne**
3. **Signature obligatoire pour validation**
4. **MCZ ne voit que sa Zone**
5. **Partenaire ne voit que ses catégories**

### Audit et traçabilité

- Toutes les actions sont enregistrées dans `audit_logs`
- Logs immuables avec timestamp, utilisateur, action, anciennes/nouvelles valeurs
- Traçabilité complète du workflow

## Cas d'erreur et rejets

### Rejet par MCZ

- Si un prestataire est rejeté, le statut passe à `REJETE_PAR_MCZ`
- Un commentaire est obligatoire
- Le prestataire ne peut plus être payé
- L'IT peut consulter les rejets pour comprendre les raisons

### Échec de paiement

- Si le paiement échoue (`FAILED`), le partenaire peut réessayer
- Le statut peut être mis à jour manuellement si nécessaire

