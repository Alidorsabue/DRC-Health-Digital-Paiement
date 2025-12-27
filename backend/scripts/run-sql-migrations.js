const { Client } = require('pg');
const { DataSource } = require('typeorm');
const fs = require('fs');
const path = require('path');

// Configuration de la base de données depuis les variables d'environnement
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'drc_digit_payment',
};

// Ordre d'exécution des migrations SQL
const migrationFiles = [
  'migrate_to_composite_primary_key.sql',
  'change_prestataire_id_format.sql',
  'migrate_ids_to_new_format.sql',
  'add_linked_enregistrement_form_id.sql',
  'add_presence_days_to_prestataires.sql',
  'add_is_sent_to_mobile.sql',
  'convert_select_values_to_labels.sql',
  'fix_default_campaign_ids.sql',
];

async function createTablesFromEntities() {
  console.log('📦 Création des tables à partir des entités TypeORM...');
  
  // Importer et initialiser le DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'drc_digit_payment',
    entities: [__dirname + '/../dist/**/*.entity.js'],
    synchronize: true, // Activer temporairement pour créer les tables
    logging: false,
  });
  
  try {
    await dataSource.initialize();
    console.log('✅ Tables créées à partir des entités');
    await dataSource.destroy();
  } catch (error) {
    // Si les tables existent déjà, c'est OK
    if (error.message && error.message.includes('already exists')) {
      console.log('ℹ️  Les tables existent déjà, continuation...');
    } else {
      console.error('⚠️  Erreur lors de la création des tables:', error.message);
      // Ne pas bloquer, continuer quand même
    }
    try {
      await dataSource.destroy();
    } catch (e) {
      // Ignorer les erreurs de destruction
    }
  }
}

async function runMigrations() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');
    
    // Créer la table de suivi des migrations si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_history (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table migrations_history créée/vérifiée');
    
    const migrationsDir = path.join(__dirname, '../migrations');
    
    for (const filename of migrationFiles) {
      const filePath = path.join(migrationsDir, filename);
      
      // Vérifier si le fichier existe
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Fichier ${filename} introuvable, ignoré`);
        continue;
      }
      
      // Vérifier si la migration a déjà été exécutée
      const checkResult = await client.query(
        'SELECT filename FROM migrations_history WHERE filename = $1',
        [filename]
      );
      
      if (checkResult.rows.length > 0) {
        console.log(`⏭️  Migration ${filename} déjà exécutée, ignorée`);
        continue;
      }
      
      // Lire et exécuter le fichier SQL
      console.log(`📝 Exécution de ${filename}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Exécuter le SQL
      await client.query(sql);
      
      // Enregistrer dans l'historique
      await client.query(
        'INSERT INTO migrations_history (filename) VALUES ($1)',
        [filename]
      );
      
      console.log(`✅ Migration ${filename} exécutée avec succès`);
    }
    
    console.log('🎉 Toutes les migrations ont été exécutées');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function main() {
  // D'abord créer les tables à partir des entités
  await createTablesFromEntities();
  
  // Ensuite exécuter les migrations SQL
  await runMigrations();
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

