-- Migration: Corriger la colonne telephone dans la table users
-- Date: 2026-01-06
-- Description: S'assure que la colonne telephone existe et n'a pas de valeurs NULL avant la synchronisation TypeORM

-- Étape 1: Vérifier si la table users existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'users'
    ) THEN
        RAISE NOTICE 'La table users n''existe pas encore. Elle sera créée par TypeORM.';
        RETURN;
    END IF;
END $$;

-- Étape 2: Si la colonne n'existe pas encore, l'ajouter comme nullable
-- Cela permet à TypeORM de simplement modifier la contrainte au lieu d'essayer d'ajouter une colonne NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'telephone'
    ) THEN
        ALTER TABLE users ADD COLUMN telephone VARCHAR NULL;
        RAISE NOTICE 'Colonne telephone ajoutée comme nullable';
    ELSE
        RAISE NOTICE 'Colonne telephone existe déjà';
    END IF;
END $$;

-- Étape 3: Mettre à jour les valeurs NULL avec une valeur par défaut basée sur le username ou l'ID
-- Format: +243XXXXXXXXX (9 chiffres après l'indicatif)
DO $$
DECLARE
    user_record RECORD;
    default_phone VARCHAR;
BEGIN
    FOR user_record IN 
        SELECT id, username, email 
        FROM users 
        WHERE telephone IS NULL OR telephone = ''
    LOOP
        -- Générer un numéro par défaut basé sur le username ou l'ID
        -- Prendre les 9 premiers caractères alphanumériques et les convertir en numéro
        default_phone := CONCAT(
            '+243',
            LPAD(
                MOD(ABS(HASHTEXT(user_record.id || user_record.username)), 999999999)::TEXT,
                9,
                '0'
            )
        );
        
        UPDATE users 
        SET telephone = default_phone
        WHERE id = user_record.id;
        
        RAISE NOTICE 'Téléphone par défaut assigné à l''utilisateur %: %', user_record.username, default_phone;
    END LOOP;
END $$;

-- Étape 4: Vérifier qu'il ne reste plus de valeurs NULL
-- Si toutes les valeurs sont remplies, TypeORM pourra ajouter la contrainte NOT NULL sans problème
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM users
    WHERE telephone IS NULL OR telephone = '';
    
    IF null_count > 0 THEN
        RAISE WARNING 'Il reste % utilisateurs sans téléphone valide. La synchronisation TypeORM pourrait échouer.', null_count;
    ELSE
        RAISE NOTICE 'Tous les utilisateurs ont maintenant un numéro de téléphone. TypeORM pourra ajouter la contrainte NOT NULL.';
    END IF;
END $$;

COMMENT ON COLUMN users.telephone IS 'Numéro de téléphone de l''utilisateur (obligatoire)';

