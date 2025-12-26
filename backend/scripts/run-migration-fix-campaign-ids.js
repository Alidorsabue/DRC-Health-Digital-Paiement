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
    console.log('  Correction des campaign_id par défaut');
    console.log('========================================\n');
    
    console.log('🔌 Connexion à PostgreSQL...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'drc_digit_payment'}`);
    console.log(`   User: ${process.env.DB_USERNAME || 'postgres'}\n`);
    
    await client.connect();
    console.log('✅ Connexion réussie!\n');

    const sqlFile = path.join(__dirname, '../migrations/fix_default_campaign_ids.sql');
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Fichier de migration introuvable: ${sqlFile}`);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Exécution de la migration SQL...');
    console.log(`   Fichier: ${path.basename(sqlFile)}\n`);

    // Exécuter la migration
    await client.query(sql);

    console.log('\n✅ Migration terminée avec succès!\n');

    // Vérification
    console.log('📊 Vérification des résultats...\n');
    
    const tablesResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename LIKE 'form_%'
      ORDER BY tablename;
    `);

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

      const checkResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN campaign_id LIKE 'DEFAULT_CAMPAIGN_%' THEN 1 END) as default_campaigns
        FROM "${table.tablename}";
      `);

      if (checkResult.rows.length > 0) {
        const stats = checkResult.rows[0];
        if (stats.default_campaigns > 0) {
          console.log(`⚠️  ${table.tablename}: ${stats.default_campaigns} lignes avec DEFAULT_CAMPAIGN restantes`);
        } else {
          console.log(`✅ ${table.tablename}: Toutes les lignes ont un campaign_id valide`);
        }
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
console.log('⚠️  ATTENTION: Cette migration va corriger les campaign_id avec DEFAULT_CAMPAIGN.');
console.log('   Les valeurs DEFAULT_CAMPAIGN_* seront remplacées par l\'ID de la campagne active.\n');

// Demander confirmation
if (process.argv.includes('--yes') || process.argv.includes('-y')) {
  runMigration();
} else {
  console.log('Pour exécuter la migration, utilisez:');
  console.log('   node scripts/run-migration-fix-campaign-ids.js --yes\n');
  console.log('Ou ajoutez le script au package.json:\n');
  console.log('   npm run migration:fix-campaign-ids\n');
  
  // Exécuter quand même si on est en mode non-interactif
  if (process.env.CI || process.env.NODE_ENV === 'production') {
    console.log('Mode non-interactif détecté, exécution de la migration...\n');
    runMigration();
  } else {
    console.log('Migration non exécutée. Utilisez --yes pour confirmer.');
    process.exit(0);
  }
}

