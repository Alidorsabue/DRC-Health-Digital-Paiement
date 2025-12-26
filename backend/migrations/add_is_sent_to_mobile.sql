-- Migration: Ajouter le champ isSentToMobile à la table form_versions
-- Date: 2025-01-XX
-- Description: Ajoute le champ isSentToMobile pour indiquer si un formulaire publié est envoyé aux applications mobiles

-- Ajouter la colonne isSentToMobile avec une valeur par défaut à false
ALTER TABLE form_versions 
ADD COLUMN IF NOT EXISTS "isSentToMobile" BOOLEAN NOT NULL DEFAULT false;

-- Créer un index pour améliorer les performances des requêtes de synchronisation mobile
CREATE INDEX IF NOT EXISTS idx_form_versions_is_sent_to_mobile 
ON form_versions("isSentToMobile") 
WHERE "isSentToMobile" = true;

-- Commentaire sur la colonne
COMMENT ON COLUMN form_versions."isSentToMobile" IS 'Indique si le formulaire publié est envoyé aux applications mobiles';

