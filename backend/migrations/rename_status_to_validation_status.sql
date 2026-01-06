-- Migration: Renommer la colonne 'status' en 'validation_status' dans toutes les tables form_*
-- Cette migration sépare le statut de validation IT (validation_status) du statut d'approbation MCZ (approval_status)

-- 1. Trouver toutes les tables form_* et renommer la colonne status en validation_status
DO $$
DECLARE
    table_record RECORD;
    sql_statement TEXT;
BEGIN
    -- Parcourir toutes les tables qui commencent par 'form_'
    FOR table_record IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'form_%'
        AND table_type = 'BASE TABLE'
    LOOP
        -- Vérifier si la colonne 'status' existe et si 'validation_status' n'existe pas déjà
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'status'
        ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'validation_status'
        ) THEN
            -- Renommer la colonne status en validation_status
            sql_statement := format('ALTER TABLE %I RENAME COLUMN status TO validation_status', table_record.table_name);
            EXECUTE sql_statement;
            RAISE NOTICE 'Colonne renommée dans la table %: status -> validation_status', table_record.table_name;
        ELSIF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'status'
        ) AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'validation_status'
        ) THEN
            -- Les deux colonnes existent, migrer les données de status vers validation_status
            -- Si validation_status est NULL ou ENREGISTRE, copier la valeur de status
            sql_statement := format(
                'UPDATE %I SET validation_status = status WHERE validation_status IS NULL OR validation_status = ''ENREGISTRE''',
                table_record.table_name
            );
            EXECUTE sql_statement;
            RAISE NOTICE 'Données migrées de status vers validation_status dans la table %', table_record.table_name;
            
            -- Supprimer la colonne status après migration
            sql_statement := format('ALTER TABLE %I DROP COLUMN status', table_record.table_name);
            EXECUTE sql_statement;
            RAISE NOTICE 'Colonne status supprimée de la table %', table_record.table_name;
        ELSE
            RAISE NOTICE 'Table % ignorée (status n''existe pas ou validation_status existe déjà)', table_record.table_name;
        END IF;
    END LOOP;
END $$;

-- 2. Mettre à jour les valeurs : déplacer les valeurs d'approbation vers approval_status
-- Si validation_status contient une valeur d'approbation (APPROUVE_PAR_MCZ, REJETE_PAR_MCZ, EN_ATTENTE_PAR_MCZ)
-- et que approval_status est NULL, déplacer la valeur vers approval_status et mettre validation_status à VALIDE_PAR_IT
DO $$
DECLARE
    table_record RECORD;
    sql_statement TEXT;
BEGIN
    FOR table_record IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'form_%'
        AND table_type = 'BASE TABLE'
    LOOP
        -- Vérifier que les colonnes nécessaires existent
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'validation_status'
        ) AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'approval_status'
        ) THEN
            -- Déplacer les valeurs d'approbation vers approval_status
            -- Si validation_status contient une valeur d'approbation et approval_status est NULL
            sql_statement := format(
                'UPDATE %I 
                 SET approval_status = validation_status,
                     validation_status = ''VALIDE_PAR_IT''
                 WHERE validation_status IN (''APPROUVE_PAR_MCZ'', ''REJETE_PAR_MCZ'', ''EN_ATTENTE_PAR_MCZ'')
                 AND (approval_status IS NULL OR approval_status = '''' OR approval_status = ''ENREGISTRE'')',
                table_record.table_name
            );
            EXECUTE sql_statement;
            RAISE NOTICE 'Valeurs d''approbation déplacées vers approval_status dans la table %', table_record.table_name;
        END IF;
    END LOOP;
END $$;

-- 3. S'assurer que validation_status contient VALIDE_PAR_IT pour les prestataires qui ont une date de validation
-- mais dont validation_status n'est pas VALIDE_PAR_IT
DO $$
DECLARE
    table_record RECORD;
    sql_statement TEXT;
BEGIN
    FOR table_record IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'form_%'
        AND table_type = 'BASE TABLE'
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'validation_status'
        ) AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = table_record.table_name
            AND column_name = 'validation_date'
        ) THEN
            -- Si validation_date existe mais validation_status n'est pas VALIDE_PAR_IT
            sql_statement := format(
                'UPDATE %I 
                 SET validation_status = ''VALIDE_PAR_IT''
                 WHERE validation_date IS NOT NULL
                 AND validation_status IS NOT NULL
                 AND validation_status != ''VALIDE_PAR_IT''
                 AND validation_status NOT IN (''APPROUVE_PAR_MCZ'', ''REJETE_PAR_MCZ'', ''EN_ATTENTE_PAR_MCZ'')',
                table_record.table_name
            );
            EXECUTE sql_statement;
            RAISE NOTICE 'validation_status mis à jour pour les prestataires avec validation_date dans la table %', table_record.table_name;
        END IF;
    END LOOP;
END $$;

-- Afficher un résumé
DO $$
DECLARE
    table_count INTEGER;
    tables_with_validation_status INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'form_%'
    AND table_type = 'BASE TABLE';
    
    SELECT COUNT(DISTINCT table_name) INTO tables_with_validation_status
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name LIKE 'form_%'
    AND column_name = 'validation_status';
    
    RAISE NOTICE 'Migration terminée: % tables form_* trouvées, % avec validation_status', table_count, tables_with_validation_status;
END $$;

