-- Migration: Ajouter la colonne linkedEnregistrementFormId à la table forms
-- Date: 2025-12-09
-- Description: Permet de lier un formulaire de validation à un formulaire d'enregistrement

-- Ajouter la colonne linkedEnregistrementFormId (nullable, UUID)
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS "linkedEnregistrementFormId" VARCHAR(255);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN forms."linkedEnregistrementFormId" IS 'ID du formulaire d''enregistrement lié (pour les formulaires de type validation)';

-- Optionnel: Ajouter un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_forms_linked_enregistrement_form_id 
ON forms("linkedEnregistrementFormId");

