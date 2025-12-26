-- Migration : Conversion vers clé primaire composite (id, campaign_id)
-- Cette migration permet d'avoir plusieurs lignes avec le même id si campaign_id est différent
-- Format: PRIMARY KEY (id, campaign_id)

-- ============================================================================
-- PARTIE 1: Fonction pour migrer une table spécifique
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_table_to_composite_pk(p_table_name TEXT)
RETURNS VOID AS $$
DECLARE
  has_campaign_id BOOLEAN;
  has_id_pk BOOLEAN;
  null_campaign_count INTEGER;
  default_campaign_id TEXT := 'DEFAULT_CAMPAIGN_' || TO_CHAR(NOW(), 'YYYYMMDDHH24MISS');
BEGIN
  -- Vérifier si la table existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND information_schema.tables.table_name = p_table_name
  ) THEN
    RAISE NOTICE 'Table % n''existe pas, ignorée', p_table_name;
    RETURN;
  END IF;

  -- Vérifier si la colonne campaign_id existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND information_schema.columns.table_name = p_table_name
    AND column_name = 'campaign_id'
  ) INTO has_campaign_id;

  IF NOT has_campaign_id THEN
    RAISE NOTICE 'Table % n''a pas de colonne campaign_id, ignorée', p_table_name;
    RETURN;
  END IF;

  -- Vérifier si id est actuellement une clé primaire
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
    AND tc.table_name = p_table_name
    AND tc.constraint_type = 'PRIMARY KEY'
    AND kcu.column_name = 'id'
  ) INTO has_id_pk;

  -- Compter les lignes avec campaign_id NULL
  EXECUTE format('SELECT COUNT(*) FROM %I WHERE campaign_id IS NULL', p_table_name) INTO null_campaign_count;

  -- Si des lignes ont campaign_id NULL, leur assigner une valeur par défaut
  IF null_campaign_count > 0 THEN
    RAISE NOTICE 'Table %: % lignes avec campaign_id NULL, assignation d''une valeur par défaut', p_table_name, null_campaign_count;
    EXECUTE format('UPDATE %I SET campaign_id = %L WHERE campaign_id IS NULL', p_table_name, default_campaign_id);
  END IF;

  -- Modifier campaign_id pour être NOT NULL si ce n'est pas déjà le cas
  BEGIN
    EXECUTE format('ALTER TABLE %I ALTER COLUMN campaign_id SET NOT NULL', p_table_name);
    RAISE NOTICE 'Table %: campaign_id modifié en NOT NULL', p_table_name;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Table %: campaign_id est déjà NOT NULL ou erreur: %', p_table_name, SQLERRM;
  END;

  -- Supprimer l'ancienne clé primaire si elle existe
  IF has_id_pk THEN
    BEGIN
      -- Récupérer le nom de la contrainte de clé primaire
      DECLARE
        pk_constraint_name TEXT;
      BEGIN
        SELECT tc.constraint_name INTO pk_constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.table_name = p_table_name
        AND tc.constraint_type = 'PRIMARY KEY'
        LIMIT 1;

        IF pk_constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table_name, pk_constraint_name);
          RAISE NOTICE 'Table %: Ancienne clé primaire supprimée', p_table_name;
        END IF;
      END;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Table %: Erreur lors de la suppression de l''ancienne clé primaire: %', p_table_name, SQLERRM;
    END;
  END IF;

  -- Créer la nouvelle clé primaire composite
  BEGIN
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id, campaign_id)', p_table_name);
    RAISE NOTICE 'Table %: Nouvelle clé primaire composite (id, campaign_id) créée', p_table_name;
  EXCEPTION WHEN OTHERS THEN
    -- Vérifier si la clé primaire composite existe déjà
    IF SQLSTATE = '42P16' OR SQLERRM LIKE '%already exists%' THEN
      RAISE NOTICE 'Table %: Clé primaire composite existe déjà', p_table_name;
    ELSE
      RAISE EXCEPTION 'Erreur lors de la création de la clé primaire composite pour %: %', p_table_name, SQLERRM;
    END IF;
  END;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTIE 2: Migration de toutes les tables form_*
-- ============================================================================

DO $$
DECLARE
  table_record RECORD;
  table_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration vers clé primaire composite';
  RAISE NOTICE 'Format: PRIMARY KEY (id, campaign_id)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Trouver toutes les tables form_*
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'form_%'
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Migration de la table: %', table_record.tablename;
    PERFORM migrate_table_to_composite_pk(table_record.tablename);
    table_count := table_count + 1;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration terminée!';
  RAISE NOTICE 'Tables migrées: %', table_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTIE 3: Nettoyage
-- ============================================================================

DROP FUNCTION IF EXISTS migrate_table_to_composite_pk(TEXT);

-- ============================================================================
-- PARTIE 4: Vérification
-- ============================================================================

DO $$
DECLARE
  table_record RECORD;
  pk_info RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Vérification des clés primaires';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'form_%'
    ORDER BY tablename
  LOOP
    -- Vérifier la clé primaire
    SELECT 
      tc.constraint_name,
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    INTO pk_info
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public'
    AND tc.table_name = table_record.tablename
    AND tc.constraint_type = 'PRIMARY KEY'
    GROUP BY tc.constraint_name
    LIMIT 1;

    IF pk_info.constraint_name IS NOT NULL THEN
      IF pk_info.columns = 'id, campaign_id' THEN
        RAISE NOTICE '✅ %: Clé primaire composite (id, campaign_id) OK', table_record.tablename;
      ELSE
        RAISE NOTICE '⚠️  %: Clé primaire: %', table_record.tablename, pk_info.columns;
      END IF;
    ELSE
      RAISE NOTICE '❌ %: Aucune clé primaire trouvée', table_record.tablename;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

