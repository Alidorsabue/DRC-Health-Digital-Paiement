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
    console.log('  Migration des IDs vers nouveau format');
    console.log('  Format: ID-YYMM-HHmm-XXX');
    console.log('========================================\n');
    
    console.log('🔌 Connexion à PostgreSQL...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'drc_digit_payment'}`);
    console.log(`   User: ${process.env.DB_USERNAME || 'postgres'}\n`);
    
    await client.connect();
    console.log('✅ Connexion réussie!\n');

    const sqlFile = path.join(__dirname, '../migrations/migrate_ids_to_new_format.sql');
    
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
    
    // Vérifier les prestataires
    const prestatairesCheck = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN id LIKE 'ID-____-____-___' THEN 1 END) as nouveau_format
      FROM prestataires;
    `);
    
    if (prestatairesCheck.rows.length > 0) {
      const stats = prestatairesCheck.rows[0];
      console.log('Prestataires:');
      console.log(`   - Total: ${stats.total}`);
      console.log(`   - Nouveau format: ${stats.nouveau_format}`);
      console.log(`   - Ancien format: ${stats.total - stats.nouveau_format}\n`);
    }

    // Vérifier les tables de formulaires
    const formTables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'form_%'
      ORDER BY tablename;
    `);

    if (formTables.rows.length > 0) {
      console.log(`Tables de formulaires trouvées: ${formTables.rows.length}\n`);
      
      for (const table of formTables.rows) {
        const tableName = table.tablename;
        
        // Vérifier si la table a une colonne submission_id
        const hasColumn = await client.query(`
          SELECT COUNT(*) as count
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = 'submission_id';
        `, [tableName]);
        
        if (hasColumn.rows[0].count > 0) {
          const submissionCheck = await client.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN submission_id LIKE 'ID-____-____-___' THEN 1 END) as nouveau_format
            FROM "${tableName}"
            WHERE submission_id IS NOT NULL;
          `);
          
          if (submissionCheck.rows.length > 0) {
            const stats = submissionCheck.rows[0];
            if (stats.total > 0) {
              console.log(`${tableName}:`);
              console.log(`   - Total: ${stats.total}`);
              console.log(`   - Nouveau format: ${stats.nouveau_format}`);
              console.log(`   - Ancien format: ${stats.total - stats.nouveau_format}`);
            }
          }
        }
      }
    }

    // Vérifier l'unicité des IDs
    console.log('\n🔍 Vérification de l\'unicité des IDs...\n');
    
    const duplicates = await client.query(`
      SELECT id, COUNT(*) as count
      FROM prestataires
      GROUP BY id
      HAVING COUNT(*) > 1;
    `);
    
    if (duplicates.rows.length > 0) {
      console.log('⚠️  ATTENTION: IDs en double détectés:');
      duplicates.rows.forEach(row => {
        console.log(`   - ${row.id}: ${row.count} occurrences`);
      });
    } else {
      console.log('✅ Aucun ID en double détecté');
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
console.log('⚠️  ATTENTION: Cette migration va modifier les IDs des prestataires et soumissions.');
console.log('   Assurez-vous d\'avoir fait une sauvegarde de la base de données.\n');

// Demander confirmation (optionnel, peut être commenté pour exécution automatique)
if (process.argv.includes('--yes') || process.argv.includes('-y')) {
  runMigration();
} else {
  console.log('Pour exécuter la migration, utilisez:');
  console.log('   node scripts/run-migration-ids.js --yes\n');
  console.log('Ou ajoutez le script au package.json:\n');
  console.log('   npm run migration:ids\n');
  
  // Exécuter quand même si on est en mode non-interactif
  if (process.env.CI || process.env.NODE_ENV === 'production') {
    console.log('Mode non-interactif détecté, exécution de la migration...\n');
    runMigration();
  } else {
    console.log('Migration non exécutée. Utilisez --yes pour confirmer.');
    process.exit(0);
  }
}

