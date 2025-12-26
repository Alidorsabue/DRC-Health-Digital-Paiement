/**
 * Script pour exécuter la migration SQL spécifique
 * pour ajouter la colonne presenceDays à la table prestataires.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env si disponible
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#][^=]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
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
    console.log('🔌 Connexion à PostgreSQL...');
    await client.connect();
    console.log('✅ Connexion réussie!\n');

    const sqlFile = path.join(__dirname, '../migrations/add_presence_days_to_prestataires.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Exécution de la migration SQL...');
    console.log('   Fichier:', path.basename(sqlFile));

    await client.query(sql);

    console.log('\n✅ Migration terminée avec succès!');

    // Vérification simple
    const checkColumnQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'prestataires' AND column_name = 'presenceDays';
    `;
    const result = await client.query(checkColumnQuery);

    if (result.rows.length > 0) {
      const columnInfo = result.rows[0];
      console.log('\n📊 Colonne créée:');
      console.log(`   - Nom: ${columnInfo.column_name}`);
      console.log(`   - Type: ${columnInfo.data_type}`);
      console.log(`   - Nullable: ${columnInfo.is_nullable === 'YES' ? 'YES' : 'NO'}`);
    } else {
      console.log('\n❌ La colonne presenceDays n\'a pas été trouvée après la migration.');
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    if (error.position) {
      console.error(`   Position dans le SQL: ${error.position}`);
    }
    console.error('\nDétails:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée.');
  }
}

runMigration();

