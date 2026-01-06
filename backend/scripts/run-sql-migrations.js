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
// IMPORTANT: Les migrations pré-synchronisation doivent être avant createTablesFromEntities()
const preSyncMigrationFiles = [
  'fix_users_telephone_not_null.sql',  // Doit être exécutée AVANT la synchronisation
];

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
  console.log('🔍 Variables d\'environnement:');
  console.log(`   DB_HOST: ${process.env.DB_HOST || 'non défini'}`);
  console.log(`   DB_PORT: ${process.env.DB_PORT || 'non défini'}`);
  console.log(`   DB_USERNAME: ${process.env.DB_USERNAME || 'non défini'}`);
  console.log(`   DB_NAME: ${process.env.DB_NAME || 'non défini'}`);
  
  // Trouver tous les fichiers d'entités compilés
  const distPath = path.join(__dirname, '../dist');
  const entities = [];
  
  function findEntities(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        findEntities(fullPath);
      } else if (file.name.endsWith('.entity.js')) {
        entities.push(fullPath);
        console.log(`   ✅ Trouvé: ${file.name}`);
      }
    }
  }
  
  if (fs.existsSync(distPath)) {
    console.log('🔍 Recherche des entités dans dist/...');
    findEntities(distPath);
    console.log(`📊 Total: ${entities.length} entités trouvées`);
  } else {
    console.error('❌ Le dossier dist/ n\'existe pas!');
    throw new Error('Le dossier dist/ n\'existe pas. Assurez-vous que le build a réussi.');
  }
  
  if (entities.length === 0) {
    console.error('❌ Aucune entité trouvée!');
    throw new Error('Aucune entité trouvée dans dist/. Vérifiez que le build a réussi.');
  }
  
  // Importer et initialiser le DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'drc_digit_payment',
    entities: entities, // Utiliser le tableau d'entités trouvées
    synchronize: true, // Activer temporairement pour créer les tables
    logging: true, // Activer les logs pour debug
  });
  
  try {
    console.log('🔌 Initialisation de la connexion TypeORM...');
    await dataSource.initialize();
    console.log('✅ Connexion TypeORM établie');
    console.log('📊 Synchronisation du schéma (création des tables)...');
    // La synchronisation se fait automatiquement lors de l'initialisation avec synchronize: true
    // Attendre un peu pour que la synchronisation se termine
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Vérifier que les tables ont été créées
    const queryRunner = dataSource.createQueryRunner();
    const tables = await queryRunner.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log(`✅ ${tables.length} tables trouvées dans la base de données:`);
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });
    await queryRunner.release();
    
    console.log('✅ Tables créées à partir des entités');
    await dataSource.destroy();
    console.log('✅ Connexion TypeORM fermée');
  } catch (error) {
    console.error('❌ Erreur lors de la création des tables:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    // Ne pas continuer si la création des tables échoue
    try {
      await dataSource.destroy();
    } catch (e) {
      // Ignorer les erreurs de destruction
    }
    throw error; // Propager l'erreur pour arrêter le processus
  }
}

async function runPreSyncMigrations() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔌 Connexion à la base de données pour les migrations pré-synchronisation...');
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
    
    if (preSyncMigrationFiles.length === 0) {
      console.log('ℹ️  Aucune migration pré-synchronisation à exécuter');
      return;
    }
    
    console.log('📋 Exécution des migrations pré-synchronisation...');
    
    for (const filename of preSyncMigrationFiles) {
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
        console.log(`⏭️  Migration pré-sync ${filename} déjà exécutée, ignorée`);
        continue;
      }
      
      // Lire et exécuter le fichier SQL
      console.log(`📝 Exécution pré-sync de ${filename}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Exécuter le SQL
      await client.query(sql);
      
      // Enregistrer dans l'historique
      await client.query(
        'INSERT INTO migrations_history (filename) VALUES ($1)',
        [filename]
      );
      
      console.log(`✅ Migration pré-sync ${filename} exécutée avec succès`);
    }
    
    console.log('✅ Migrations pré-synchronisation terminées');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations pré-synchronisation:', error);
    throw error;
  } finally {
    await client.end();
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
  console.log('');
  console.log('========================================');
  console.log('🚀 DÉMARRAGE DES MIGRATIONS');
  console.log('========================================');
  console.log('');
  
  try {
    // D'abord exécuter les migrations pré-synchronisation (pour corriger les données existantes)
    await runPreSyncMigrations();
    
    // Ensuite créer/mettre à jour les tables à partir des entités
    await createTablesFromEntities();
    
    // Enfin exécuter les migrations SQL normales
    await runMigrations();
    
    console.log('');
    console.log('========================================');
    console.log('✅ MIGRATIONS TERMINÉES AVEC SUCCÈS');
    console.log('========================================');
    console.log('');
  } catch (error) {
    console.log('');
    console.log('========================================');
    console.error('❌ ERREUR FATALE DANS LES MIGRATIONS');
    console.log('========================================');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.log('');
    throw error;
  }
}

main().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

