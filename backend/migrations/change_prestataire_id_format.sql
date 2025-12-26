-- Migration: Changer le format de l'ID des prestataires de UUID à ID-YYMMDD-HHMM-XX
-- Date: 2025-12-05
-- Description: Modifie la colonne id de la table prestataires pour utiliser un format personnalisé
-- ⚠️ IMPORTANT: Exécutez cette migration manuellement avant de démarrer l'application

-- Étape 1: Vérifier s'il y a des prestataires existants
DO $$
DECLARE
    prestataire_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO prestataire_count FROM prestataires;
    RAISE NOTICE 'Nombre de prestataires existants: %', prestataire_count;
END $$;

-- Étape 2: Supprimer les contraintes de clé étrangère qui référencent prestataires.id
-- Note: Sauvegardez les données avant d'exécuter ces commandes

-- Supprimer la contrainte de clé étrangère de validations_it
ALTER TABLE "validations_it" DROP CONSTRAINT IF EXISTS "FK_8c5f950b8bf82a03773e70cd21c";
ALTER TABLE "validations_it" DROP CONSTRAINT IF EXISTS "REL_8c5f950b8bf82a03773e70cd21c";

-- Supprimer la contrainte de clé étrangère de approvals_mcz
ALTER TABLE "approvals_mcz" DROP CONSTRAINT IF EXISTS "FK_15805e556898129e6d4a12967b9";

-- Supprimer la contrainte de clé étrangère de payments
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_4e3db467ddde2b0ccc22f0e642e";

-- Étape 3: Supprimer la contrainte de clé primaire actuelle
ALTER TABLE prestataires DROP CONSTRAINT IF EXISTS "PK_prestataires";
ALTER TABLE prestataires DROP CONSTRAINT IF EXISTS "PK_0bd9977e04dca68de22d1c6f8a2";

-- Étape 4: Créer une nouvelle colonne temporaire avec le nouveau format
ALTER TABLE prestataires 
ADD COLUMN IF NOT EXISTS "id_new" VARCHAR(20);

-- Étape 5: Générer les nouveaux IDs pour les prestataires existants
-- Note: Cette requête génère un ID basé sur la date de création
UPDATE prestataires 
SET "id_new" = CONCAT(
  'ID-',
  TO_CHAR("createdAt", 'YYMMDD'),
  '-',
  TO_CHAR("createdAt", 'HH24MI'),
  '-',
  LPAD((FLOOR(RANDOM() * 90 + 10))::TEXT, 2, '0')
)
WHERE "id_new" IS NULL;

-- Étape 6: Gérer les doublons potentiels (ajouter un suffixe unique si nécessaire)
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Compter les doublons
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT "id_new", COUNT(*) as cnt
        FROM prestataires
        WHERE "id_new" IS NOT NULL
        GROUP BY "id_new"
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'ATTENTION: % IDs en double détectés. Ajout d''un suffixe unique.', duplicate_count;
        
        -- Ajouter un suffixe unique aux doublons
        UPDATE prestataires p1
        SET "id_new" = CONCAT(p1."id_new", '-', ROW_NUMBER() OVER (PARTITION BY p1."id_new" ORDER BY p1."createdAt"))
        WHERE EXISTS (
            SELECT 1 FROM prestataires p2
            WHERE p2."id_new" = p1."id_new"
            AND p2."id" != p1."id"
        );
    END IF;
END $$;

-- Étape 7: Supprimer l'ancienne colonne id (si elle existe encore)
ALTER TABLE prestataires DROP COLUMN IF EXISTS "id";

-- Étape 8: Renommer la nouvelle colonne
ALTER TABLE prestataires RENAME COLUMN "id_new" TO "id";

-- Étape 9: Définir la nouvelle colonne comme clé primaire et NOT NULL
ALTER TABLE prestataires 
ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE prestataires 
ADD PRIMARY KEY ("id");

-- Étape 10: Recréer les contraintes de clé étrangère
-- Note: Vous devrez peut-être ajuster les types de colonnes dans les tables référencées

-- Recréer la contrainte pour validations_it
ALTER TABLE "validations_it" 
ALTER COLUMN "prestataire_id" TYPE VARCHAR(20);

ALTER TABLE "validations_it"
ADD CONSTRAINT "FK_8c5f950b8bf82a03773e70cd21c" 
FOREIGN KEY ("prestataire_id") REFERENCES "prestataires"("id") ON DELETE CASCADE;

ALTER TABLE "validations_it"
ADD CONSTRAINT "REL_8c5f950b8bf82a03773e70cd21c" UNIQUE ("prestataire_id");

-- Recréer la contrainte pour approvals_mcz (si elle existe)
-- ALTER TABLE "approvals_mcz" 
-- ALTER COLUMN "prestataire_id" TYPE VARCHAR(20);
-- ALTER TABLE "approvals_mcz"
-- ADD CONSTRAINT "FK_15805e556898129e6d4a12967b9" 
-- FOREIGN KEY ("prestataire_id") REFERENCES "prestataires"("id") ON DELETE CASCADE;

-- Recréer la contrainte pour payments (si elle existe)
-- ALTER TABLE "payments" 
-- ALTER COLUMN "prestataire_id" TYPE VARCHAR(20);
-- ALTER TABLE "payments"
-- ADD CONSTRAINT "FK_4e3db467ddde2b0ccc22f0e642e" 
-- FOREIGN KEY ("prestataire_id") REFERENCES "prestataires"("id") ON DELETE CASCADE;

-- Étape 11: Créer un index unique sur la colonne id
CREATE UNIQUE INDEX IF NOT EXISTS "idx_prestataires_id_unique" ON prestataires("id");

-- Commentaire sur la colonne
COMMENT ON COLUMN prestataires."id" IS 'ID unique au format ID-YYMMDD-HHMM-XX où YYMMDD=année+mois+jour, HHMM=heure+minute, XX=nombre aléatoire unique';

-- Vérification finale
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM prestataires WHERE "id" IS NULL;
    IF null_count > 0 THEN
        RAISE EXCEPTION 'ERREUR: % prestataires ont encore un ID NULL après la migration', null_count;
    ELSE
        RAISE NOTICE 'Migration réussie: Tous les prestataires ont un ID valide';
    END IF;
END $$;

