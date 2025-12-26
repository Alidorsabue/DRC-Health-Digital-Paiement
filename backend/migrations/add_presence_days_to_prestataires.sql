-- Migration: Ajouter le champ presenceDays à la table prestataires
-- Date: 2025-01-09
-- Description: Ajoute le champ presenceDays pour stocker le nombre de jours de présence lors de la validation

ALTER TABLE prestataires
ADD COLUMN IF NOT EXISTS "presenceDays" integer NULL;

COMMENT ON COLUMN prestataires."presenceDays" IS 'Nombre de jours de présence du prestataire (rempli lors de la validation)';

