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
    console.log('  Conversion des valeurs select en libellés');
    console.log('  Remplace les valeurs techniques par les libellés');
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
      AND tablename NOT IN ('forms', 'form_versions')
      ORDER BY tablename;
    `);

    if (tablesResult.rows.length === 0) {
      console.log('⚠️  Aucune table form_* trouvée.');
      return;
    }

    console.log(`📊 Tables form_* trouvées: ${tablesResult.rows.length}\n`);
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.tablename}`);
    });
    console.log('');

    const sqlFile = path.join(__dirname, '../migrations/convert_select_values_to_labels.sql');
    
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
    
    // Afficher quelques exemples de données converties
    for (const table of tablesResult.rows.slice(0, 3)) { // Limiter à 3 tables pour l'affichage
      // Vérifier quelles colonnes existent avant de les sélectionner
      // Les colonnes sont stockées en minuscules dans PostgreSQL (provinceid, antenneid, zoneid, aireid)
      // Support rétrocompatibilité avec les anciens noms (admin1_h_c, etc.)
      const columnsCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND LOWER(column_name) IN ('provinceid', 'antenneid', 'zoneid', 'aireid', 'admin1_h_c', 'admin2_h_c', 'admin3_h_c', 'admin4_h_c')
        ORDER BY CASE LOWER(column_name)
          WHEN 'provinceid' THEN 1
          WHEN 'antenneid' THEN 2
          WHEN 'zoneid' THEN 3
          WHEN 'aireid' THEN 4
          WHEN 'admin1_h_c' THEN 5
          WHEN 'admin2_h_c' THEN 6
          WHEN 'admin3_h_c' THEN 7
          WHEN 'admin4_h_c' THEN 8
          ELSE 9
        END;
      `, [table.tablename]);

      if (columnsCheck.rows.length === 0) {
        console.log(`${table.tablename}: Aucune colonne géographique trouvée (provinceId, antenneId, zoneId, aireId)`);
        continue;
      }

      const columnNames = columnsCheck.rows.map(r => `"${r.column_name}"`).join(', ');
      const firstColumn = columnsCheck.rows[0].column_name;
      
      const sampleResult = await client.query(`
        SELECT ${columnNames}
        FROM "${table.tablename}"
        WHERE "${firstColumn}" IS NOT NULL
        LIMIT 5;
      `);

      if (sampleResult.rows.length > 0) {
        console.log(`${table.tablename} - Exemples de données:`);
        sampleResult.rows.forEach((row, idx) => {
          const values = columnsCheck.rows.map(col => {
            const colName = col.column_name;
            return `${colName}: ${row[colName] || 'N/A'}`;
          }).join(', ');
          console.log(`   ${idx + 1}. ${values}`);
        });
        console.log('');
      }
    }

    console.log('✅ Migration et vérification terminées avec succès!');

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
console.log('⚠️  ATTENTION: Cette migration va convertir les valeurs techniques des champs select en libellés.');
console.log('   - Les valeurs comme "CD10" seront remplacées par "Kinshasa"');
console.log('   - Assurez-vous d\'avoir fait une sauvegarde de la base de données.\n');

// Demander confirmation
if (process.argv.includes('--yes') || process.argv.includes('-y')) {
  runMigration();
} else {
  console.log('Pour exécuter la migration, utilisez:');
  console.log('   node scripts/run-migration-select-labels.js --yes\n');
  console.log('Ou ajoutez le script au package.json:\n');
  console.log('   npm run migration:select-labels\n');
  
  // Exécuter quand même si on est en mode non-interactif
  if (process.env.CI || process.env.NODE_ENV === 'production') {
    console.log('Mode non-interactif détecté, exécution de la migration...\n');
    runMigration();
  } else {
    console.log('Migration non exécutée. Utilisez --yes pour confirmer.');
    process.exit(0);
  }
}

