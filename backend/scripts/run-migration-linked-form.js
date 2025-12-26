/**
 * Script pour exécuter la migration SQL: add_linked_enregistrement_form_id.sql
 * Ajoute la colonne linkedEnregistrementFormId à la table forms
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
    console.log(' Connexion réussie!\n');

    const sqlFile = path.join(__dirname, '../migrations/add_linked_enregistrement_form_id.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log(' Exécution de la migration SQL...');
    console.log('   Fichier: add_linked_enregistrement_form_id.sql\n');

    // Exécuter le script SQL complet
    await client.query(sql);

    console.log(' Migration terminée avec succès!');

    // Vérification
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'forms' AND column_name = 'linkedEnregistrementFormId'
    `);
    
    if (result.rows.length > 0) {
      console.log('\n Colonne créée:');
      console.log(`   - Nom: ${result.rows[0].column_name}`);
      console.log(`   - Type: ${result.rows[0].data_type}`);
      console.log(`   - Nullable: ${result.rows[0].is_nullable}`);
    } else {
      console.log('\n  La colonne n\'a pas été trouvée après la migration');
    }

  } catch (error) {
    console.error('\n Erreur lors de la migration:', error.message);
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

