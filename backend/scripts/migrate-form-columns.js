/**
 * Script de migration pour remplir les colonnes géographiques dans les tables form_*
 * 
 * Ce script extrait les valeurs géographiques depuis raw_data et les insère dans
 * les colonnes provinceId, antenneId, zoneId, aireId
 * 
 * Usage: 
 *   npm run migration:form-columns
 *   ou
 *   node scripts/migrate-form-columns.js --yes
 */

const { Client } = require('pg');
require('dotenv').config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'drc_digit_payment',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
};

async function migrateFormColumns() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('✅ Connexion à la base de données établie\n');

    // Récupérer toutes les tables form_*
    const formTablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'form_%'
      ORDER BY tablename;
    `);

    const formTables = formTablesResult.rows;
    console.log(`📋 ${formTables.length} tables form_* trouvées\n`);

    if (formTables.length === 0) {
      console.log('Aucune table form_* à migrer.');
      await client.end();
      return;
    }

    // Demander confirmation si --yes n'est pas passé
    const args = process.argv.slice(2);
    const autoConfirm = args.includes('--yes');
    
    if (!autoConfirm) {
      console.log('⚠️  Ce script va remplir les colonnes géographiques dans toutes les tables form_*:');
      console.log('   - provinceId, antenneId, zoneId, aireId');
      console.log('   - Les valeurs seront extraites depuis raw_data\n');
      console.log('Pour confirmer, exécutez avec --yes');
      await client.end();
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let totalUpdated = 0;

    for (const table of formTables) {
      const tableName = table.tablename;
      console.log(`🔄 Migration de la table: ${tableName}`);

      try {
        // Vérifier quelles colonnes géographiques existent
        const columnsResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          AND LOWER(column_name) IN ('provinceid', 'antenneid', 'zoneid', 'aireid')
        `, [tableName]);

        const existingColumns = columnsResult.rows.map(r => r.column_name);
        const existingColumnsLower = new Set(existingColumns.map(c => c.toLowerCase()));

        if (existingColumns.length === 0) {
          console.log(`   ⚠ Aucune colonne géographique trouvée (provinceId, zoneId, aireId, antenneId)\n`);
          successCount++;
          continue;
        }

        console.log(`   📍 Colonnes géographiques trouvées: ${existingColumns.join(', ')}`);

        // Vérifier si la table a une colonne raw_data
        const rawDataColumnCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            AND column_name = 'raw_data'
          )
        `, [tableName]);

        if (!rawDataColumnCheck.rows[0].exists) {
          console.log(`   ⚠ Colonne raw_data introuvable, impossible d'extraire les valeurs\n`);
          successCount++;
          continue;
        }

        // Récupérer toutes les lignes avec raw_data
        const rowsResult = await client.query(`
          SELECT id, raw_data
          FROM "${tableName}"
          WHERE raw_data IS NOT NULL
        `);

        if (rowsResult.rows.length === 0) {
          console.log(`   ⚠ Aucune donnée avec raw_data trouvée\n`);
          successCount++;
          continue;
        }

        console.log(`   📊 ${rowsResult.rows.length} lignes à traiter`);

        let updatedRows = 0;

        // Pour chaque ligne, extraire les valeurs géographiques et les mettre à jour
        for (const row of rowsResult.rows) {
          try {
            const rawData = row.raw_data;
            let provinceId = null;
            let antenneId = null;
            let zoneId = null;
            let aireId = null;

            // Extraire les valeurs depuis raw_data
            if (typeof rawData === 'object' && rawData !== null) {
              // Chercher dans différentes clés possibles (priorité: nouveaux noms > anciens noms)
              provinceId = rawData.provinceId || rawData.province_id || rawData.admin1_h_c || null;
              antenneId = rawData.antenneId || rawData.antenne_id || rawData.admin2_h_c || null;
              zoneId = rawData.zoneId || rawData.zone_id || rawData.admin3_h_c || null;
              aireId = rawData.aireId || rawData.aire_id || rawData.admin4_h_c || null;
            } else if (typeof rawData === 'string') {
              try {
                const parsed = JSON.parse(rawData);
                provinceId = parsed.provinceId || parsed.province_id || parsed.admin1_h_c || null;
                antenneId = parsed.antenneId || parsed.antenne_id || parsed.admin2_h_c || null;
                zoneId = parsed.zoneId || parsed.zone_id || parsed.admin3_h_c || null;
                aireId = parsed.aireId || parsed.aire_id || parsed.admin4_h_c || null;
              } catch (e) {
                // Ignorer les erreurs de parsing
              }
            }

            // Construire la requête UPDATE dynamiquement selon les colonnes existantes
            const updates = [];
            const values = [];
            let paramIndex = 1;

            if (existingColumnsLower.has('provinceid') && provinceId !== null) {
              const colName = existingColumns.find(c => c.toLowerCase() === 'provinceid');
              updates.push(`"${colName}" = $${paramIndex}`);
              values.push(provinceId);
              paramIndex++;
            }

            if (existingColumnsLower.has('antenneid') && antenneId !== null) {
              const colName = existingColumns.find(c => c.toLowerCase() === 'antenneid');
              updates.push(`"${colName}" = $${paramIndex}`);
              values.push(antenneId);
              paramIndex++;
            }

            if (existingColumnsLower.has('zoneid') && zoneId !== null) {
              const colName = existingColumns.find(c => c.toLowerCase() === 'zoneid');
              updates.push(`"${colName}" = $${paramIndex}`);
              values.push(zoneId);
              paramIndex++;
            }

            if (existingColumnsLower.has('aireid') && aireId !== null) {
              const colName = existingColumns.find(c => c.toLowerCase() === 'aireid');
              updates.push(`"${colName}" = $${paramIndex}`);
              values.push(aireId);
              paramIndex++;
            }

            // Mettre à jour seulement si on a des valeurs à insérer
            if (updates.length > 0) {
              values.push(row.id);
              const updateSQL = `
                UPDATE "${tableName}"
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
              `;
              
              await client.query(updateSQL, values);
              updatedRows++;
            }
          } catch (error) {
            console.warn(`   ⚠ Erreur lors du traitement de la ligne ${row.id}:`, error.message);
          }
        }

        if (updatedRows > 0) {
          console.log(`   ✅ ${updatedRows} lignes mises à jour\n`);
          totalUpdated += updatedRows;
        } else {
          console.log(`   ⚠ Aucune ligne mise à jour (valeurs non trouvées dans raw_data)\n`);
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Erreur lors de la migration de ${tableName}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 Résumé de la migration:');
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log(`   📋 Total tables: ${formTables.length}`);
    console.log(`   📝 Total lignes mises à jour: ${totalUpdated}`);

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Exécuter la migration
migrateFormColumns()
  .then(() => {
    console.log('\n✅ Migration terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
