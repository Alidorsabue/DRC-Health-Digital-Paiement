-- Migration : Corriger les campaign_id avec DEFAULT_CAMPAIGN
-- Remplace les valeurs DEFAULT_CAMPAIGN_* par l'ID de la campagne active correspondante

-- ============================================================================
-- PARTIE 1: Fonction pour corriger les campaign_id par défaut
-- ============================================================================

DO $$
DECLARE
  table_record RECORD;
  campaign_record RECORD;
  updated_count INTEGER;
  total_updated INTEGER := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Correction des campaign_id par défaut';
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
    -- Vérifier si la table a une colonne campaign_id
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = table_record.tablename
      AND column_name = 'campaign_id'
    ) THEN
        -- Extraire le form_id depuis le nom de la table (form_<form_id>)
      DECLARE
        form_id_from_table TEXT;
        table_name_without_prefix TEXT;
      BEGIN
        table_name_without_prefix := REPLACE(table_record.tablename, 'form_', '');
        -- Le nom de la table utilise des underscores au lieu de tirets pour l'UUID
        -- Convertir: form_7d733b84_7555_4e5a_987a_e7bba83a411b -> 7d733b84-7555-4e5a-987a-e7bba83a411b
        -- Format UUID: 8-4-4-4-12 caractères
        IF LENGTH(table_name_without_prefix) = 36 THEN
          -- C'est déjà au bon format (avec tirets)
          form_id_from_table := table_name_without_prefix;
        ELSE
          -- Convertir les underscores en tirets aux bonnes positions (8-4-4-4-12)
          form_id_from_table := 
            SUBSTRING(table_name_without_prefix, 1, 8) || '-' ||
            SUBSTRING(table_name_without_prefix, 9, 4) || '-' ||
            SUBSTRING(table_name_without_prefix, 13, 4) || '-' ||
            SUBSTRING(table_name_without_prefix, 17, 4) || '-' ||
            SUBSTRING(table_name_without_prefix, 21);
        END IF;
        
        -- Trouver la campagne active qui utilise ce formulaire
        -- La colonne dans la base de données est enregistrement_form_id (snake_case) de type UUID
        -- Caster form_id_from_table en UUID pour la comparaison
        -- Vérifier d'abord quelle colonne existe (isActive ou is_active)
        DECLARE
          active_column_name TEXT;
        BEGIN
          -- Vérifier quelle colonne existe
          SELECT column_name INTO active_column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'campaigns'
          AND (column_name = 'isActive' OR column_name = 'is_active')
          LIMIT 1;
          
          IF active_column_name IS NOT NULL THEN
            -- Trouver la campagne active
            EXECUTE format(
              'SELECT id FROM campaigns WHERE enregistrement_form_id::TEXT = %L AND %I = true LIMIT 1',
              form_id_from_table,
              active_column_name
            ) INTO campaign_record;
          ELSE
            -- Si aucune colonne trouvée, prendre toutes les campagnes
            SELECT id INTO campaign_record
            FROM campaigns
            WHERE enregistrement_form_id::TEXT = form_id_from_table
            LIMIT 1;
          END IF;
        END;
        
        -- Si pas de campagne active, prendre la première campagne qui utilise ce formulaire
        IF campaign_record IS NULL THEN
          SELECT id INTO campaign_record
          FROM campaigns
          WHERE enregistrement_form_id::TEXT = form_id_from_table
          LIMIT 1;
        END IF;
        
        -- Si une campagne est trouvée, mettre à jour les lignes avec DEFAULT_CAMPAIGN
        IF campaign_record IS NOT NULL THEN
          EXECUTE format(
            'UPDATE %I SET campaign_id = %L WHERE campaign_id LIKE %L',
            table_record.tablename,
            campaign_record.id,
            'DEFAULT_CAMPAIGN_%'
          );
          
          GET DIAGNOSTICS updated_count = ROW_COUNT;
          
          IF updated_count > 0 THEN
            RAISE NOTICE 'Table %: % lignes mises à jour avec campagne %', 
              table_record.tablename, updated_count, campaign_record.id;
            total_updated := total_updated + updated_count;
          END IF;
        ELSE
          RAISE NOTICE 'Table %: Aucune campagne trouvée pour form_id %', 
            table_record.tablename, form_id_from_table;
        END IF;
      END;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Correction terminée!';
  RAISE NOTICE 'Total de lignes mises à jour: %', total_updated;
  RAISE NOTICE '========================================';
END $$;

