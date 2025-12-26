/**
 * Script simplifié pour exécuter la migration SQL
 * Exécute le fichier SQL complet en une seule transaction
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

    const sqlFile = path.join(__dirname, '../migrations/change_prestataire_id_format.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Exécution de la migration SQL...');
    console.log('⚠️  Cette opération peut prendre quelques instants...\n');

    // Exécuter le script SQL complet
    await client.query(sql);

    console.log('\n✅ Migration terminée avec succès!');

    // Vérification
    const result = await client.query('SELECT COUNT(*) as total, COUNT(id) as with_id FROM prestataires');
    console.log(`\n📊 Total prestataires: ${result.rows[0].total}`);
    console.log(`📊 Prestataires avec ID: ${result.rows[0].with_id}`);

    if (result.rows[0].total > 0) {
      const sampleResult = await client.query('SELECT id FROM prestataires LIMIT 5');
      console.log('\n📋 Exemples d\'IDs générés:');
      sampleResult.rows.forEach(row => {
        console.log(`   - ${row.id}`);
      });
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

