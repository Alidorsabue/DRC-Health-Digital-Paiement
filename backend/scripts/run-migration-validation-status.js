const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement depuis .env si disponible (pour développement local)
function loadEnv() {
  try {
    // Essayer d'abord avec dotenv si disponible
    if (require.resolve('dotenv')) {
      require('dotenv').config();
    }
  } catch (e) {
    // dotenv n'est pas disponible, charger manuellement depuis .env
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#][^=]*)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  }
}

loadEnv();

async function runMigration() {
  // Railway utilise généralement POSTGRES_URL ou des variables séparées
  // Support pour POSTGRES_URL (format: postgresql://user:password@host:port/database)
  let dbConfig;
  
  if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    console.log('📡 Utilisation de POSTGRES_URL/DATABASE_URL pour la connexion');
    dbConfig = {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }, // Railway nécessite SSL
    };
  } else {
    // Variables d'environnement séparées (pour développement local ou configuration personnalisée)
    console.log('📡 Utilisation des variables d\'environnement individuelles');
    dbConfig = {
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.PGPORT || '5432', 10),
      database: process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
      user: process.env.DB_USER || process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
      ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
    };
  }

  const client = new Client(dbConfig);

  try {
    console.log('🔌 Connexion à la base de données...');
    await client.connect();
    console.log('✅ Connecté à la base de données');

    // Lire le fichier SQL
    const sqlFilePath = path.join(__dirname, '../migrations/rename_status_to_validation_status.sql');
    console.log(`📄 Lecture du fichier de migration: ${sqlFilePath}`);
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Le fichier de migration n'existe pas: ${sqlFilePath}`);
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('📝 Exécution de la migration...\n');

    // Exécuter la migration
    const result = await client.query(sql);
    
    console.log('\n✅ Migration terminée avec succès!');
    console.log('📊 Résumé:');
    console.log('   - Colonne "status" renommée en "validation_status" dans toutes les tables form_*');
    console.log('   - Valeurs d\'approbation déplacées vers "approval_status"');
    console.log('   - "validation_status" mis à jour pour les prestataires avec validation_date');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Connexion fermée');
  }
}

// Exécuter la migration
runMigration();

