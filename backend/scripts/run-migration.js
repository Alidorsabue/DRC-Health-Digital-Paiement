/**
 * Script pour exécuter la migration SQL du format d'ID des prestataires
 * Utilise Node.js et le package 'pg' pour se connecter à PostgreSQL
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
  // Configuration de la connexion depuis les variables d'environnement
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

    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, '../migrations/change_prestataire_id_format.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Exécution de la migration SQL...');
    console.log('⚠️  Cette opération peut prendre quelques instants...\n');

    // Exécuter le script SQL
    // Note: PostgreSQL ne supporte pas l'exécution de plusieurs commandes dans une seule requête
    // Nous devons diviser le script en commandes individuelles
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      
      // Ignorer les blocs DO $$ ... END $$ car ils contiennent des points-virgules
      if (command.includes('DO $$')) {
        // Trouver la fin du bloc DO
        let fullCommand = command;
        let j = i + 1;
        while (j < commands.length && !commands[j].includes('END $$')) {
          fullCommand += '; ' + commands[j];
          j++;
        }
        if (j < commands.length) {
          fullCommand += '; ' + commands[j];
          i = j;
        }
        
        try {
          await client.query(fullCommand);
          console.log(`✓ Commande ${i + 1}/${commands.length} exécutée`);
        } catch (error) {
          // Ignorer certaines erreurs attendues (comme "IF NOT EXISTS")
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate')) {
            console.log(`⚠ Commande ${i + 1}/${commands.length}: ${error.message.split('\n')[0]}`);
          } else {
            throw error;
          }
        }
      } else {
        try {
          await client.query(command);
          console.log(`✓ Commande ${i + 1}/${commands.length} exécutée`);
        } catch (error) {
          // Ignorer certaines erreurs attendues
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('duplicate') ||
              error.message.includes('IF NOT EXISTS') ||
              error.message.includes('IF EXISTS')) {
            console.log(`⚠ Commande ${i + 1}/${commands.length}: ${error.message.split('\n')[0]}`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migration terminée avec succès!');
    console.log('\n📊 Vérification des résultats...');

    // Vérifier que tous les prestataires ont un ID valide
    const result = await client.query('SELECT COUNT(*) as total, COUNT(id) as with_id FROM prestataires');
    console.log(`   Total prestataires: ${result.rows[0].total}`);
    console.log(`   Prestataires avec ID: ${result.rows[0].with_id}`);

    if (result.rows[0].total > 0) {
      const sampleResult = await client.query('SELECT id FROM prestataires LIMIT 5');
      console.log('\n   Exemples d\'IDs générés:');
      sampleResult.rows.forEach(row => {
        console.log(`   - ${row.id}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de la migration:', error.message);
    console.error('\nDétails:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée.');
  }
}

// Exécuter la migration
runMigration();

