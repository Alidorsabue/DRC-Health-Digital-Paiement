-- Migration : Convertir les valeurs techniques des champs select en libellés
-- Pour les données déjà enregistrées, remplace les valeurs techniques (ex: "CD10") par les libellés (ex: "Kinshasa")

-- ============================================================================
-- PARTIE 1: Fonction pour convertir les valeurs d'un champ select
-- ============================================================================

CREATE OR REPLACE FUNCTION convert_select_value_to_label(
  technical_value TEXT,
  options_json JSONB
) RETURNS TEXT AS $$
DECLARE
  option_record JSONB;
  option_value TEXT;
  option_label TEXT;
BEGIN
  -- Si la valeur est NULL ou vide, retourner tel quel
  IF technical_value IS NULL OR technical_value = '' THEN
    RETURN technical_value;
  END IF;

  -- Parcourir les options pour trouver celle qui correspond à la valeur technique
  FOR option_record IN SELECT * FROM jsonb_array_elements(options_json)
  LOOP
    -- Récupérer la valeur et le libellé de l'option
    option_value := option_record->>'value';
    option_label := option_record->>'label';
    
    -- Comparer avec la valeur technique (comparaison insensible à la casse et aux espaces)
    IF TRIM(LOWER(COALESCE(option_value, ''))) = TRIM(LOWER(COALESCE(technical_value, ''))) THEN
      -- Si le libellé existe, le retourner, sinon retourner la valeur originale
      IF option_label IS NOT NULL AND option_label != '' THEN
        RETURN option_label;
      END IF;
    END IF;
  END LOOP;
  
  -- Si aucune option trouvée, retourner la valeur originale
  RETURN technical_value;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTIE 2: Fonction pour migrer une table spécifique
-- ============================================================================

CREATE OR REPLACE FUNCTION migrate_table_select_values_to_labels(
  p_table_name TEXT,
  p_form_id TEXT
)
RETURNS VOID AS $$
DECLARE
  schema_json JSONB;
  properties_json JSONB;
  field_name TEXT;
  field_schema JSONB;
  field_type TEXT;
  options_json JSONB;
  is_select_one BOOLEAN;
  is_select_multiple BOOLEAN;
  update_sql TEXT;
  affected_rows INTEGER;
BEGIN
  -- Récupérer le schéma du formulaire depuis form_versions
  -- TypeORM utilise camelCase pour les colonnes
  -- Caster f.id en TEXT pour la comparaison avec p_form_id
  SELECT fv.schema INTO schema_json
  FROM form_versions fv
  JOIN forms f ON f.id::TEXT = fv."formId"::TEXT
  WHERE f.id::TEXT = p_form_id
  AND fv."isPublished" = true
  ORDER BY fv.version DESC
  LIMIT 1;

  IF schema_json IS NULL THEN
    RAISE NOTICE 'Table %: Schéma non trouvé pour form_id %', p_table_name, p_form_id;
    RETURN;
  END IF;

  properties_json := schema_json->'properties';
  IF properties_json IS NULL THEN
    RAISE NOTICE 'Table %: Propriétés non trouvées dans le schéma', p_table_name;
    RETURN;
  END IF;

  -- Parcourir tous les champs du schéma
  FOR field_name, field_schema IN SELECT * FROM jsonb_each(properties_json)
  LOOP
    -- Vérifier si c'est un champ select
    field_type := field_schema->>'x-type';
    IF field_type IS NULL THEN
      field_type := field_schema->>'type';
    END IF;

    is_select_one := (field_type = 'select_one' OR (field_schema->>'type' = 'string' AND field_schema ? 'enum'));
    is_select_multiple := (field_type = 'select_multiple' OR (field_schema->>'type' = 'array' AND (field_schema->'items') ? 'enum'));

    IF is_select_one OR is_select_multiple THEN
      -- Récupérer les options
      IF field_schema ? 'x-options' THEN
        options_json := field_schema->'x-options';
      ELSIF field_schema->'items' ? 'x-options' THEN
        options_json := field_schema->'items'->'x-options';
      ELSE
        RAISE NOTICE 'Table %: Champ % n''a pas d''options (x-options)', p_table_name, field_name;
        CONTINUE;
      END IF;

      IF options_json IS NULL OR jsonb_array_length(options_json) = 0 THEN
        RAISE NOTICE 'Table %: Champ % a des options vides', p_table_name, field_name;
        CONTINUE;
      END IF;

      -- Vérifier si la colonne existe dans la table (chercher avec le nom exact et en minuscules)
      DECLARE
        column_exists BOOLEAN;
        actual_column_name TEXT;
      BEGIN
        -- Chercher la colonne avec le nom exact
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = p_table_name
          AND column_name = field_name
        ) INTO column_exists;

        -- Si la colonne n'existe pas avec le nom exact, chercher en minuscules
        IF NOT column_exists THEN
          SELECT column_name INTO actual_column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = p_table_name
          AND LOWER(column_name) = LOWER(field_name)
          LIMIT 1;

          IF actual_column_name IS NOT NULL THEN
            field_name := actual_column_name;
            column_exists := true;
            RAISE NOTICE 'Table %: Colonne trouvée avec casse différente: % (recherché: %)', p_table_name, actual_column_name, field_name;
          END IF;
        END IF;

        IF NOT column_exists THEN
          RAISE NOTICE 'Table %: Colonne % n''existe pas', p_table_name, field_name;
          CONTINUE;
        END IF;
      END;

      -- Afficher les premières options pour débogage
      RAISE NOTICE 'Table %: Champ % - % options trouvées. Exemple: %', 
        p_table_name, field_name, jsonb_array_length(options_json),
        (SELECT jsonb_pretty(options_json->0) LIMIT 1);

      -- Construire la requête de mise à jour
      IF is_select_one THEN
        -- Pour select_one: remplacer directement la valeur
        update_sql := format(
          'UPDATE %I SET %I = convert_select_value_to_label(%I::TEXT, %L::jsonb) WHERE %I IS NOT NULL',
          p_table_name,
          field_name,
          field_name,
          options_json::TEXT,
          field_name
        );
      ELSE
        -- Pour select_multiple: c'est un tableau JSONB
        -- Utiliser une sous-requête pour convertir chaque élément du tableau
        update_sql := format(
          'UPDATE %I SET %I = (
            SELECT jsonb_agg(
              COALESCE(
                (SELECT opt->>''label''
                 FROM jsonb_array_elements(%L::jsonb) AS opt
                 WHERE opt->>''value'' = elem::TEXT
                 LIMIT 1),
                elem::TEXT
              )
            )
            FROM jsonb_array_elements(%I::jsonb) AS elem
          ) WHERE %I IS NOT NULL AND jsonb_typeof(%I) = ''array''',
          p_table_name,
          field_name,
          options_json::TEXT,
          field_name,
          field_name,
          field_name
        );
      END IF;

      -- Tester la fonction de conversion avec une valeur réelle avant de faire l'UPDATE
      DECLARE
        test_value TEXT;
        test_result TEXT;
        sample_options TEXT;
      BEGIN
        -- Récupérer une valeur réelle de la table pour tester
        EXECUTE format('SELECT %I::TEXT FROM %I WHERE %I IS NOT NULL LIMIT 1', 
          field_name, p_table_name, field_name) INTO test_value;
        
        IF test_value IS NOT NULL THEN
          test_result := convert_select_value_to_label(test_value, options_json);
          -- Afficher quelques options pour débogage
          SELECT jsonb_agg(jsonb_build_object('value', opt->>'value', 'label', opt->>'label'))::TEXT
          INTO sample_options
          FROM (SELECT * FROM jsonb_array_elements(options_json) LIMIT 3) AS opt;
          
          IF test_result != test_value THEN
            RAISE NOTICE 'Table %: ✅ Test conversion pour champ %: "%" -> "%"', 
              p_table_name, field_name, test_value, test_result;
          ELSE
            RAISE NOTICE 'Table %: ⚠️  Test conversion pour champ %: "%" n''a pas été converti (aucune correspondance trouvée)', 
              p_table_name, field_name, test_value;
            RAISE NOTICE 'Table %: Options disponibles (premiers 3): %', p_table_name, sample_options;
          END IF;
        END IF;
      END;

      -- Exécuter la mise à jour
      BEGIN
        -- Afficher la requête SQL pour débogage (premiers 200 caractères)
        RAISE NOTICE 'Table %: Exécution UPDATE pour champ %', p_table_name, field_name;
        EXECUTE update_sql;
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        IF affected_rows > 0 THEN
          RAISE NOTICE 'Table %: ✅ % lignes mises à jour pour le champ %', p_table_name, affected_rows, field_name;
        ELSE
          RAISE NOTICE 'Table %: ⚠️  Aucune ligne mise à jour pour le champ % (peut-être que les valeurs sont déjà des libellés ou ne correspondent pas)', p_table_name, field_name;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Table %: ❌ Erreur lors de la mise à jour du champ %: %', p_table_name, field_name, SQLERRM;
        RAISE NOTICE 'Table %: SQL (premiers 500 caractères): %', p_table_name, LEFT(update_sql, 500);
      END;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTIE 3: Migration de toutes les tables form_*
-- ============================================================================

DO $$
DECLARE
  table_record RECORD;
  form_id_from_table TEXT;
  table_count INTEGER := 0;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Conversion des valeurs select en libellés';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Trouver toutes les tables form_*
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename LIKE 'form_%'
    AND tablename NOT IN ('forms', 'form_versions')
    ORDER BY tablename
  LOOP
    -- Extraire le form_id depuis le nom de la table
    form_id_from_table := REPLACE(table_record.tablename, 'form_', '');
    -- Convertir les underscores en tirets pour obtenir l'UUID
    IF LENGTH(form_id_from_table) = 36 THEN
      -- C'est déjà au bon format (avec tirets)
      NULL;
    ELSE
      -- Convertir les underscores en tirets aux bonnes positions (8-4-4-4-12)
      form_id_from_table := 
        SUBSTRING(form_id_from_table, 1, 8) || '-' ||
        SUBSTRING(form_id_from_table, 9, 4) || '-' ||
        SUBSTRING(form_id_from_table, 13, 4) || '-' ||
        SUBSTRING(form_id_from_table, 17, 4) || '-' ||
        SUBSTRING(form_id_from_table, 21);
    END IF;

    RAISE NOTICE 'Migration de la table: % (form_id: %)', table_record.tablename, form_id_from_table;
    
    PERFORM migrate_table_select_values_to_labels(table_record.tablename, form_id_from_table);
    
    table_count := table_count + 1;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration terminée!';
  RAISE NOTICE 'Tables migrées: %', table_count;
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTIE 4: Nettoyage
-- ============================================================================

DROP FUNCTION IF EXISTS migrate_table_select_values_to_labels(TEXT, TEXT);
DROP FUNCTION IF EXISTS convert_select_value_to_label(TEXT, JSONB);

