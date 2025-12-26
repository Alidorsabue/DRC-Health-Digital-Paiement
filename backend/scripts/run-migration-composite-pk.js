const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

loadEnv();

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'drc_digit_payment',
  });

  try {
    console.log('========================================');
    console.log('  Migration vers clé primaire composite');
    console.log('  Format: PRIMARY KEY (id, campaign_id)');
    console.log('========================================\n');
    
    console.log('🔌 Connexion à PostgreSQL...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'drc_digit_payment'}`);
    console.log(`   User: ${process.env.DB_USERNAME || 'postgres'}\n`);
    
    await client.connect();
    console.log('✅ Connexion réussie!\n');

    // Vérifier les tables existantes
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'form_%'
      ORDER BY tablename;
    `);

    if (tablesResult.rows.length === 0) {
      console.log('⚠️  Aucune table form_* trouvée.');
      console.log('   La migration sera appliquée lors de la création de nouvelles tables.\n');
    } else {
      console.log(`📊 Tables form_* trouvées: ${tablesResult.rows.length}\n`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.tablename}`);
      });
      console.log('');
    }

    const sqlFile = path.join(__dirname, '../migrations/migrate_to_composite_primary_key.sql');
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Fichier de migration introuvable: ${sqlFile}`);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Exécution de la migration SQL...');
    console.log(`   Fichier: ${path.basename(sqlFile)}\n`);

    // Exécuter la migration
    await client.query(sql);

    console.log('\n✅ Migration terminée avec succès!\n');

    // Vérification détaillée
    console.log('📊 Vérification des résultats...\n');
    
    const verificationResult = await client.query(`
      SELECT 
        t.tablename,
        CASE 
          WHEN pk.columns = 'id, campaign_id' THEN '✅ Composite (id, campaign_id)'
          WHEN pk.columns IS NOT NULL THEN '⚠️  ' || pk.columns
          ELSE '❌ Aucune clé primaire'
        END as primary_key_status
      FROM pg_tables t
      LEFT JOIN (
        SELECT 
          tc.table_name,
          string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'PRIMARY KEY'
        GROUP BY tc.table_name
      ) pk ON t.tablename = pk.table_name
      WHERE t.schemaname = 'public'
      AND t.tablename LIKE 'form_%'
      ORDER BY t.tablename;
    `);

    if (verificationResult.rows.length > 0) {
      console.log('Statut des clés primaires:');
      verificationResult.rows.forEach(row => {
        console.log(`   ${row.tablename}: ${row.primary_key_status}`);
      });
    }

    // Vérifier les doublons potentiels
    console.log('\n🔍 Vérification des doublons (id, campaign_id)...\n');
    
    for (const table of tablesResult.rows) {
      // Vérifier si la table a une colonne campaign_id
      const hasCampaignId = await client.query(`
        SELECT COUNT(*) as count
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = 'campaign_id';
      `, [table.tablename]);

      if (hasCampaignId.rows[0].count === '0') {
        console.log(`⏭️  ${table.tablename}: Pas de colonne campaign_id, ignorée`);
        continue;
      }

      const duplicatesResult = await client.query(`
        SELECT id, campaign_id, COUNT(*) as count
        FROM "${table.tablename}"
        GROUP BY id, campaign_id
        HAVING COUNT(*) > 1;
      `);

      if (duplicatesResult.rows.length > 0) {
        console.log(`⚠️  ${table.tablename}: Doublons détectés:`);
        duplicatesResult.rows.forEach(row => {
          console.log(`   - id: ${row.id}, campaign_id: ${row.campaign_id}, count: ${row.count}`);
        });
      } else {
        console.log(`✅ ${table.tablename}: Aucun doublon`);
      }
    }

    console.log('\n✅ Migration et vérification terminées avec succès!');

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    if (error.position) {
      console.error(`   Position dans le SQL: ${error.position}`);
    }
    if (error.detail) {
      console.error(`   Détail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Suggestion: ${error.hint}`);
    }
    console.error('\nDétails complets:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée.');
  }
}

// Avertissement avant exécution
console.log('⚠️  ATTENTION: Cette migration va modifier les clés primaires des tables form_*.');
console.log('   - Les tables passeront de PRIMARY KEY (id) à PRIMARY KEY (id, campaign_id)');
console.log('   - Les lignes avec campaign_id NULL recevront une valeur par défaut');
console.log('   - Assurez-vous d\'avoir fait une sauvegarde de la base de données.\n');

// Demander confirmation
if (process.argv.includes('--yes') || process.argv.includes('-y')) {
  runMigration();
} else {
  console.log('Pour exécuter la migration, utilisez:');
  console.log('   node scripts/run-migration-composite-pk.js --yes\n');
  console.log('Ou ajoutez le script au package.json:\n');
  console.log('   npm run migration:composite-pk\n');
  
  // Exécuter quand même si on est en mode non-interactif
  if (process.env.CI || process.env.NODE_ENV === 'production') {
    console.log('Mode non-interactif détecté, exécution de la migration...\n');
    runMigration();
  } else {
    console.log('Migration non exécutée. Utilisez --yes pour confirmer.');
    process.exit(0);
  }
}

