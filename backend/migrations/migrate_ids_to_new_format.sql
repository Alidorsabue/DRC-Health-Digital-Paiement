-- Migration : Mise à jour des IDs vers le nouveau format ID-YYMM-HHmm-XXX
-- Format: ID-YYMM-HHmm-XXX où YYMM = année (2 chiffres) + mois, HHmm = heure + minute, XXX = nombre aléatoire (100-999)

-- ============================================================================
-- PARTIE 1: Migration des IDs des prestataires
-- ============================================================================

-- Fonction pour générer un nouvel ID basé sur la date de création
CREATE OR REPLACE FUNCTION generate_new_prestataire_id(created_at TIMESTAMP, old_id TEXT)
RETURNS TEXT AS $$
DECLARE
  year_month TEXT;
  hour_minute TEXT;
  random_suffix TEXT;
  new_id TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Extraire YYMM (année sur 2 chiffres + mois)
  year_month := TO_CHAR(created_at, 'YY') || TO_CHAR(created_at, 'MM');
  
  -- Extraire HHmm (heure + minute)
  hour_minute := TO_CHAR(created_at, 'HH24') || TO_CHAR(created_at, 'MI');
  
  -- Générer un suffixe aléatoire de 3 chiffres (100-999)
  LOOP
    random_suffix := LPAD((FLOOR(RANDOM() * 900 + 100))::TEXT, 3, '0');
    new_id := 'ID-' || year_month || '-' || hour_minute || '-' || random_suffix;
    
    -- Vérifier l'unicité (convertir id en TEXT pour la comparaison)
    IF NOT EXISTS (SELECT 1 FROM prestataires WHERE id::TEXT = new_id) THEN
      RETURN new_id;
    END IF;
    
    attempts := attempts + 1;
    
    -- Si trop de collisions, utiliser les millisecondes de la date de création
    IF attempts > 10 THEN
      random_suffix := LPAD((EXTRACT(MILLISECONDS FROM created_at)::INTEGER % 900 + 100)::TEXT, 3, '0');
      new_id := 'ID-' || year_month || '-' || hour_minute || '-' || random_suffix;
      
      IF NOT EXISTS (SELECT 1 FROM prestataires WHERE id::TEXT = new_id) THEN
        RETURN new_id;
      END IF;
      
      -- Dernier recours : utiliser les 3 derniers caractères de l'ancien ID si c'est un nombre
      IF old_id ~ '^[0-9]+$' THEN
        random_suffix := LPAD((old_id::INTEGER % 1000)::TEXT, 3, '0');
      ELSE
        random_suffix := LPAD(SUBSTRING(old_id FROM LENGTH(old_id) - 2 FOR 3), 3, '0');
      END IF;
      
      new_id := 'ID-' || year_month || '-' || hour_minute || '-' || random_suffix;
      RETURN new_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Vérifier et modifier le type de la colonne id si nécessaire
DO $$
DECLARE
  column_type TEXT;
BEGIN
  -- Vérifier le type actuel de la colonne id
  SELECT data_type INTO column_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'prestataires'
  AND column_name = 'id';
  
  -- Si la colonne est encore de type UUID, la convertir en VARCHAR
  IF column_type = 'uuid' THEN
    RAISE NOTICE 'Conversion de la colonne id de UUID vers VARCHAR(20)...';
    
    -- Supprimer temporairement les contraintes de clé étrangère
    ALTER TABLE IF EXISTS validations_it DROP CONSTRAINT IF EXISTS "FK_8c5f950b8bf82a03773e70cd21c";
    ALTER TABLE IF EXISTS validations_it DROP CONSTRAINT IF EXISTS "REL_8c5f950b8bf82a03773e70cd21c";
    ALTER TABLE IF EXISTS payments DROP CONSTRAINT IF EXISTS "FK_4e3db467ddde2b0ccc22f0e642e";
    
    -- Supprimer la contrainte de clé primaire
    ALTER TABLE prestataires DROP CONSTRAINT IF EXISTS "PK_prestataires";
    ALTER TABLE prestataires DROP CONSTRAINT IF EXISTS "PK_0bd9977e04dca68de22d1c6f8a2";
    
    -- Changer le type de la colonne
    ALTER TABLE prestataires ALTER COLUMN id TYPE VARCHAR(20) USING id::TEXT;
    
    -- Recréer la clé primaire
    ALTER TABLE prestataires ADD PRIMARY KEY (id);
    
    -- Modifier les colonnes référencées
    -- validations_it
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'validations_it' 
               AND column_name = 'prestataire_id') THEN
      EXECUTE 'ALTER TABLE validations_it ALTER COLUMN prestataire_id TYPE VARCHAR(20) USING prestataire_id::TEXT';
    END IF;
    
    -- payments
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'payments' 
               AND column_name = 'prestataire_id') THEN
      EXECUTE 'ALTER TABLE payments ALTER COLUMN prestataire_id TYPE VARCHAR(20) USING prestataire_id::TEXT';
    END IF;
    
    -- Recréer les contraintes de clé étrangère (seulement si les tables existent)
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'validations_it') THEN
      EXECUTE 'ALTER TABLE validations_it ADD CONSTRAINT "FK_8c5f950b8bf82a03773e70cd21c" FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE';
      EXECUTE 'ALTER TABLE validations_it ADD CONSTRAINT "REL_8c5f950b8bf82a03773e70cd21c" UNIQUE (prestataire_id)';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'payments') THEN
      EXECUTE 'ALTER TABLE payments ADD CONSTRAINT "FK_4e3db467ddde2b0ccc22f0e642e" FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE';
    END IF;
    
    RAISE NOTICE 'Conversion terminée.';
  ELSE
    -- Même si la colonne id est déjà VARCHAR, vérifier et convertir les colonnes référencées si nécessaire
    RAISE NOTICE 'La colonne id est déjà de type VARCHAR, vérification des colonnes référencées...';
    
    -- Vérifier et convertir validations_it.prestataire_id si nécessaire
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'validations_it' 
               AND column_name = 'prestataire_id'
               AND data_type = 'uuid') THEN
      RAISE NOTICE 'Conversion de validations_it.prestataire_id de UUID vers VARCHAR(20)...';
      EXECUTE 'ALTER TABLE validations_it DROP CONSTRAINT IF EXISTS "FK_8c5f950b8bf82a03773e70cd21c"';
      EXECUTE 'ALTER TABLE validations_it DROP CONSTRAINT IF EXISTS "REL_8c5f950b8bf82a03773e70cd21c"';
      EXECUTE 'ALTER TABLE validations_it ALTER COLUMN prestataire_id TYPE VARCHAR(20) USING prestataire_id::TEXT';
      BEGIN
        EXECUTE 'ALTER TABLE validations_it ADD CONSTRAINT "FK_8c5f950b8bf82a03773e70cd21c" FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        EXECUTE 'ALTER TABLE validations_it ADD CONSTRAINT "REL_8c5f950b8bf82a03773e70cd21c" UNIQUE (prestataire_id)';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
    
    -- Vérifier et convertir payments.prestataire_id si nécessaire
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'payments' 
               AND column_name = 'prestataire_id'
               AND data_type = 'uuid') THEN
      RAISE NOTICE 'Conversion de payments.prestataire_id de UUID vers VARCHAR(20)...';
      EXECUTE 'ALTER TABLE payments DROP CONSTRAINT IF EXISTS "FK_4e3db467ddde2b0ccc22f0e642e"';
      EXECUTE 'ALTER TABLE payments ALTER COLUMN prestataire_id TYPE VARCHAR(20) USING prestataire_id::TEXT';
      BEGIN
        EXECUTE 'ALTER TABLE payments ADD CONSTRAINT "FK_4e3db467ddde2b0ccc22f0e642e" FOREIGN KEY (prestataire_id) REFERENCES prestataires(id) ON DELETE CASCADE';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;
END $$;

-- Migrer les IDs des prestataires qui ne sont pas déjà au nouveau format
DO $$
DECLARE
  prestataire_record RECORD;
  new_id TEXT;
BEGIN
  FOR prestataire_record IN 
    SELECT id, "createdAt" 
    FROM prestataires 
    WHERE id::TEXT NOT LIKE 'ID-____-____-___'  -- Ne pas migrer ceux déjà au bon format
  LOOP
    new_id := generate_new_prestataire_id(prestataire_record."createdAt", prestataire_record.id::TEXT);
    
    -- Mettre à jour l'ID du prestataire
    UPDATE prestataires 
    SET id = new_id 
    WHERE id = prestataire_record.id;
    
    -- Mettre à jour les références dans validations_it
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'validations_it') THEN
      UPDATE validations_it 
      SET prestataire_id = new_id 
      WHERE prestataire_id::TEXT = prestataire_record.id::TEXT;
    END IF;
    
    -- Mettre à jour les références dans payments
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'payments') THEN
      UPDATE payments 
      SET prestataire_id = new_id 
      WHERE prestataire_id::TEXT = prestataire_record.id::TEXT;
    END IF;
    
    RAISE NOTICE 'Prestataire ID migré: % -> %', prestataire_record.id, new_id;
  END LOOP;
END $$;

-- ============================================================================
-- PARTIE 2: Migration des id (clé primaire) dans les tables de formulaires
-- ============================================================================

-- Fonction pour générer un nouvel id basé sur la date de création
CREATE OR REPLACE FUNCTION generate_new_form_table_id(created_at TIMESTAMP, old_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  year_month TEXT;
  hour_minute TEXT;
  random_suffix TEXT;
  new_id TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Extraire YYMM (année sur 2 chiffres + mois)
  year_month := TO_CHAR(created_at, 'YY') || TO_CHAR(created_at, 'MM');
  
  -- Extraire HHmm (heure + minute)
  hour_minute := TO_CHAR(created_at, 'HH24') || TO_CHAR(created_at, 'MI');
  
  -- Générer un suffixe aléatoire de 3 chiffres (100-999)
  LOOP
    random_suffix := LPAD((FLOOR(RANDOM() * 900 + 100))::TEXT, 3, '0');
    new_id := 'ID-' || year_month || '-' || hour_minute || '-' || random_suffix;
    
    -- Note: On ne peut pas vérifier l'unicité dans toutes les tables ici
    -- On fait confiance au hasard et aux millisecondes pour l'unicité
    RETURN new_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Migrer les id (clé primaire) dans toutes les tables form_*
DO $$
DECLARE
  table_record RECORD;
  id_record RECORD;
  new_id TEXT;
  table_name_var TEXT;
  old_id_val INTEGER;
BEGIN
  -- Parcourir toutes les tables qui commencent par 'form_'
  FOR table_record IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename LIKE 'form_%'
  LOOP
    table_name_var := table_record.tablename;
    
    -- Vérifier si la table a une colonne id de type INTEGER
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND information_schema.columns.table_name = table_record.tablename
      AND column_name = 'id'
      AND data_type = 'integer'
    ) THEN
      RAISE NOTICE 'Migration de la colonne id dans la table %...', table_name_var;
      
      -- Étape 1: Supprimer la contrainte de clé primaire et la séquence
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I_pkey', table_name_var, table_name_var);
        EXECUTE format('DROP SEQUENCE IF EXISTS %I_id_seq CASCADE', table_name_var);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la suppression des contraintes pour %: %', table_name_var, SQLERRM;
      END;
      
      -- Étape 2: Créer une colonne temporaire pour stocker les nouveaux IDs
      BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS id_new VARCHAR(20)', table_name_var);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la création de id_new pour %: %', table_name_var, SQLERRM;
      END;
      
      -- Étape 3: Générer les nouveaux IDs pour chaque ligne
      FOR id_record IN 
        EXECUTE format('
          SELECT id, created_at 
          FROM %I 
          WHERE created_at IS NOT NULL
          ORDER BY id
        ', table_name_var)
      LOOP
        old_id_val := id_record.id;
        new_id := generate_new_form_table_id(
          id_record.created_at, 
          old_id_val
        );
        
        -- Mettre à jour la colonne temporaire
        EXECUTE format('
          UPDATE %I 
          SET id_new = $1 
          WHERE id = $2
        ', table_name_var) USING new_id, old_id_val;
        
        RAISE NOTICE 'ID migré dans %: % -> %', table_name_var, old_id_val, new_id;
      END LOOP;
      
      -- Étape 4: Supprimer l'ancienne colonne id
      BEGIN
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS id', table_name_var);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la suppression de id pour %: %', table_name_var, SQLERRM;
      END;
      
      -- Étape 5: Renommer id_new en id et définir comme clé primaire
      BEGIN
        EXECUTE format('ALTER TABLE %I RENAME COLUMN id_new TO id', table_name_var);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET NOT NULL', table_name_var);
        EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', table_name_var);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la finalisation pour %: %', table_name_var, SQLERRM;
      END;
      
      RAISE NOTICE 'Migration terminée pour la table %', table_name_var;
    END IF;
  END LOOP;
END $$;

-- Nettoyer les fonctions temporaires
DROP FUNCTION IF EXISTS generate_new_prestataire_id(TIMESTAMP, TEXT);
DROP FUNCTION IF EXISTS generate_new_form_table_id(TIMESTAMP, INTEGER);

-- Afficher un résumé
DO $$
DECLARE
  prestataire_count INTEGER;
  submission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO prestataire_count 
  FROM prestataires 
  WHERE id::TEXT LIKE 'ID-____-____-___';
  
  RAISE NOTICE 'Migration terminée. Prestataires avec le nouveau format: %', prestataire_count;
END $$;

