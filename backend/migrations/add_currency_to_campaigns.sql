-- Migration: Ajouter le champ currency à la table campaigns
-- Date: 2025-01-XX
-- Description: Ajoute le champ currency pour permettre de spécifier la devise (USD par défaut)

-- Ajouter la colonne currency si elle n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'currency'
    ) THEN
        ALTER TABLE campaigns 
        ADD COLUMN currency VARCHAR(10) DEFAULT 'USD';
        
        -- Mettre à jour les campagnes existantes avec USD par défaut
        UPDATE campaigns 
        SET currency = 'USD' 
        WHERE currency IS NULL;
        
        RAISE NOTICE 'Colonne currency ajoutée à la table campaigns avec valeur par défaut USD';
    ELSE
        RAISE NOTICE 'La colonne currency existe déjà dans la table campaigns';
    END IF;
END $$;

