import { Injectable, forwardRef, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { generateSubmissionId } from '../common/utils/id-generator.util';
import { CampaignsService } from '../campaigns/campaigns.service';

@Injectable()
export class DynamicTableService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    @Inject(forwardRef(() => CampaignsService))
    private campaignsService: CampaignsService,
  ) {}

  /**
   * Génère un nom de table sécurisé à partir de l'ID du formulaire
   */
  getTableName(formId: string): string {
    // Utiliser un préfixe et nettoyer l'ID pour éviter les caractères spéciaux
    return `form_${formId.replace(/-/g, '_')}`;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.dataSource.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName],
    );
    return result[0].exists;
  }

  /**
   * Convertit un type de champ JSON Schema en type SQL
   */
  private getSqlType(fieldType: string, format?: string): string {
    switch (fieldType) {
      case 'string':
        if (format === 'date' || format === 'date-time') {
          return 'TIMESTAMP';
        }
        return 'TEXT';
      case 'number':
      case 'integer':
        return 'NUMERIC';
      case 'boolean':
        return 'BOOLEAN';
      case 'array':
        return 'JSONB';
      case 'object':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }

  /**
   * Crée ou met à jour la table pour un formulaire publié
   */
  async createOrUpdateFormTable(formId: string, schema: any): Promise<void> {
    const tableName = this.getTableName(formId);
    const properties = schema.properties || {};

    // Vérifier si la table existe
    const tableExists = await this.tableExists(tableName);

    if (!tableExists) {
      // Créer une nouvelle table
      await this.createTable(tableName, properties, schema);
    } else {
      // Mettre à jour la table existante
      await this.updateTable(tableName, properties, schema);
    }
  }

  /**
   * Vérifie si une table existe
   */

  /**
   * Crée une nouvelle table pour un formulaire
   */
  private async createTable(
    tableName: string,
    properties: Record<string, any>,
    schema: any,
  ): Promise<void> {
    // Structure de la table : ID → champs du formulaire → colonnes système/actions → raw_data
    const columns: string[] = [
      // 1. ID en premier
      'id VARCHAR(20) NOT NULL',
      'submission_id VARCHAR(255) UNIQUE NOT NULL',
      'form_id VARCHAR(255) NOT NULL',
      'form_version INTEGER NOT NULL',
      'campaign_id VARCHAR(255) NOT NULL',
    ];

    // 2. Ajouter les colonnes pour chaque champ du formulaire (dans l'ordre du schéma)
    // Trier les propriétés selon x-order pour préserver l'ordre du formulaire
    const sortedProperties = Object.entries(properties).sort(([nameA, schemaA]: [string, any], [nameB, schemaB]: [string, any]) => {
      const orderA = schemaA?.['x-order'] ?? 9999;
      const orderB = schemaB?.['x-order'] ?? 9999;
      return orderA - orderB;
    });

    for (const [fieldName, fieldSchema] of sortedProperties) {
      const field = fieldSchema as any;
      const fieldType = field.type || 'string';
      const sqlType = this.getSqlType(fieldType, field.format);
      
      // Un champ ne doit être NOT NULL que s'il est requis ET qu'il n'a pas de dépendance
      // (car les champs avec dépendance peuvent ne pas être remplis selon les conditions)
      const hasDependency = field['x-dependsOn'] != null;
      const isRequired = schema.required?.includes(fieldName) ?? false;
      const nullable = (isRequired && !hasDependency) ? 'NOT NULL' : '';
      
      // Nettoyer le nom du champ pour SQL (remplacer les caractères spéciaux)
      const cleanFieldName = this.sanitizeFieldName(fieldName);
      columns.push(`"${cleanFieldName}" ${sqlType} ${nullable}`);
    }

    // 3. Colonnes système/actions après les champs du formulaire
    columns.push(
      'prestataire_id VARCHAR(255)',
      'status VARCHAR(50) DEFAULT \'ENREGISTRE\'',
      'validation_status VARCHAR(50)',
      'presence_days INTEGER',
      'validation_date TIMESTAMP',
      'kyc_status VARCHAR(50)',
      'kyc_date TIMESTAMP',
      'approval_status VARCHAR(50)',
      'approval_date TIMESTAMP',
      'payment_status VARCHAR(50)',
      'payment_amount NUMERIC',
      'amount_to_pay NUMERIC',
      'payment_date TIMESTAMP',
      'paid_at TIMESTAMP',
      'parent_submission_id VARCHAR(255)',
      'validation_sequence INTEGER DEFAULT 0',
      'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    );

    // 4. Colonne raw_data à la fin
    columns.push('raw_data JSONB');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        ${columns.join(',\n        ')}
      );
      
      CREATE INDEX IF NOT EXISTS idx_${tableName}_form_id ON "${tableName}"(form_id);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_submission_id ON "${tableName}"(submission_id);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_prestataire_id ON "${tableName}"(prestataire_id);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON "${tableName}"(status);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_campaign_id ON "${tableName}"(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_parent_submission_id ON "${tableName}"(parent_submission_id);
      CREATE INDEX IF NOT EXISTS idx_${tableName}_created_at ON "${tableName}"(created_at);
    `;

    await this.dataSource.query(createTableSQL);
    console.log(` Table créée: ${tableName}`);
  }

  /**
   * Met à jour une table existante avec les nouveaux champs
   */
  private async updateTable(
    tableName: string,
    properties: Record<string, any>,
    schema: any,
  ): Promise<void> {
    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Ajouter les colonnes de statut si elles n'existent pas
    // Structure avec statuts séparés pour chaque action avec leurs dates
    const statusColumns = [
      { name: 'prestataire_id', type: 'VARCHAR(255)' },
      { name: 'status', type: 'VARCHAR(50) DEFAULT \'ENREGISTRE\'' }, // Statut global pour compatibilité
      { name: 'validation_status', type: 'VARCHAR(50)' }, // Statut de validation IT
      { name: 'presence_days', type: 'INTEGER' },
      { name: 'validation_date', type: 'TIMESTAMP' }, // Date de validation IT
      { name: 'kyc_status', type: 'VARCHAR(50)' },
      { name: 'kyc_date', type: 'TIMESTAMP' }, // Date de vérification KYC
      { name: 'approval_status', type: 'VARCHAR(50)' }, // Statut d'approbation MCZ
      { name: 'approval_date', type: 'TIMESTAMP' }, // Date d'approbation MCZ
      { name: 'payment_status', type: 'VARCHAR(50)' }, // Statut de paiement
      { name: 'payment_amount', type: 'NUMERIC' },
      { name: 'amount_to_pay', type: 'NUMERIC' },
      { name: 'payment_date', type: 'TIMESTAMP' }, // Date de paiement
      { name: 'paid_at', type: 'TIMESTAMP' },
      { name: 'parent_submission_id', type: 'VARCHAR(255)' },
      { name: 'validation_sequence', type: 'INTEGER DEFAULT 0' },
    ];

    for (const col of statusColumns) {
      if (!existingColumnNames.has(col.name.toLowerCase())) {
        const alterTableSQL = `
          ALTER TABLE "${tableName}" 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `;
        await this.dataSource.query(alterTableSQL);
        console.log(` Colonne de statut ajoutée: ${tableName}.${col.name}`);
      }
    }

    // Ajouter les nouvelles colonnes du formulaire et mettre à jour les contraintes existantes
    // Trier les propriétés selon x-order pour préserver l'ordre du formulaire
    const sortedProperties = Object.entries(properties).sort(([nameA, schemaA]: [string, any], [nameB, schemaB]: [string, any]) => {
      const orderA = schemaA?.['x-order'] ?? 9999;
      const orderB = schemaB?.['x-order'] ?? 9999;
      return orderA - orderB;
    });

    for (const [fieldName, fieldSchema] of sortedProperties) {
      const field = fieldSchema as any;
      const cleanFieldName = this.sanitizeFieldName(fieldName);
      const lowerFieldName = cleanFieldName.toLowerCase();

      // Vérifier si la colonne existe avec la casse exacte
      const exactColumnName = existingColumns.find((col: any) => col.column_name === cleanFieldName);
      const lowerColumnName = existingColumns.find((col: any) => col.column_name.toLowerCase() === lowerFieldName);

      // Si la colonne existe en minuscules mais pas avec la casse exacte, la renommer
      if (lowerColumnName && !exactColumnName && lowerColumnName.column_name !== cleanFieldName) {
        console.log(` [UPDATE TABLE] Colonne trouvée en minuscules: ${lowerColumnName.column_name}, renommage vers: ${cleanFieldName}`);
        try {
          await this.dataSource.query(`
            ALTER TABLE "${tableName}" 
            RENAME COLUMN "${lowerColumnName.column_name}" TO "${cleanFieldName}";
          `);
          console.log(` ✅ Colonne renommée (casse): ${tableName}.${lowerColumnName.column_name} → ${cleanFieldName}`);
          // Mettre à jour la liste des colonnes existantes
          const updatedColumns = await this.dataSource.query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = $1 
             AND table_schema = 'public'`,
            [tableName],
          );
          existingColumns.length = 0;
          existingColumns.push(...updatedColumns);
          existingColumnNames.clear();
          updatedColumns.forEach((col: any) => {
            existingColumnNames.add(col.column_name.toLowerCase());
          });
        } catch (error: any) {
          console.error(` ❌ Impossible de renommer ${lowerColumnName.column_name} → ${cleanFieldName}:`, error.message);
          throw error; // Relancer l'erreur pour qu'elle soit visible
        }
      } else if (exactColumnName) {
        console.log(` [UPDATE TABLE] Colonne existe déjà avec la bonne casse: ${cleanFieldName}`);
      }

      if (!existingColumnNames.has(lowerFieldName)) {
        // Nouvelle colonne : l'ajouter
        const fieldType = field.type || 'string';
        const sqlType = this.getSqlType(fieldType, field.format);
        
        // Un champ ne doit être NOT NULL que s'il est requis ET qu'il n'a pas de dépendance
        // (car les champs avec dépendance peuvent ne pas être remplis selon les conditions)
        const hasDependency = field['x-dependsOn'] != null;
        const isRequired = schema.required?.includes(fieldName) ?? false;
        
        // Vérifier si la table contient déjà des données
        const rowCountResult = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${tableName}"`
        );
        const rowCount = parseInt(rowCountResult[0]?.count || '0', 10);
        const hasExistingData = rowCount > 0;
        
        // Si la table contient déjà des données et qu'on veut ajouter NOT NULL,
        // on doit d'abord ajouter la colonne comme nullable, puis la remplir avec une valeur par défaut,
        // puis ajouter la contrainte NOT NULL
        if (isRequired && !hasDependency && hasExistingData) {
          // Étape 1 : Ajouter la colonne comme nullable
          const alterTableSQL1 = `
            ALTER TABLE "${tableName}" 
            ADD COLUMN IF NOT EXISTS "${cleanFieldName}" ${sqlType}
          `;
          await this.dataSource.query(alterTableSQL1);
          
          // Étape 2 : Remplir avec une valeur par défaut selon le type
          let defaultValue = '';
          if (fieldType === 'string' || fieldType === 'text') {
            defaultValue = "''";
          } else if (fieldType === 'number' || fieldType === 'integer') {
            defaultValue = '0';
          } else if (fieldType === 'boolean') {
            defaultValue = 'false';
          }
          
          if (defaultValue) {
            const updateSQL = `
              UPDATE "${tableName}" 
              SET "${cleanFieldName}" = ${defaultValue}
              WHERE "${cleanFieldName}" IS NULL
            `;
            await this.dataSource.query(updateSQL);
          }
          
          // Étape 3 : Ajouter la contrainte NOT NULL
          try {
            const alterTableSQL2 = `
              ALTER TABLE "${tableName}" 
              ALTER COLUMN "${cleanFieldName}" SET NOT NULL
            `;
            await this.dataSource.query(alterTableSQL2);
          } catch (error: any) {
            console.warn(` Impossible d'ajouter NOT NULL pour ${tableName}.${cleanFieldName}:`, error.message || error);
          }
          
          console.log(` Colonne ajoutée avec NOT NULL (table avec données): ${tableName}.${cleanFieldName}`);
        } else {
          // Table vide ou champ nullable : ajouter directement
          const nullable = (isRequired && !hasDependency && !hasExistingData) ? 'NOT NULL' : '';
          const alterTableSQL = `
            ALTER TABLE "${tableName}" 
            ADD COLUMN IF NOT EXISTS "${cleanFieldName}" ${sqlType} ${nullable}
          `;
          
          try {
            await this.dataSource.query(alterTableSQL);
            console.log(` Colonne ajoutée: ${tableName}.${cleanFieldName}`);
          } catch (error: any) {
            // Si l'erreur est due à NOT NULL sur une table avec données, réessayer sans NOT NULL
            if (error.code === '23502' || error.message?.includes('NOT NULL') || error.message?.includes('constraint')) {
              console.warn(` Erreur lors de l'ajout de NOT NULL, réessai sans contrainte: ${tableName}.${cleanFieldName}`, error.message);
              const alterTableSQLRetry = `
                ALTER TABLE "${tableName}" 
                ADD COLUMN IF NOT EXISTS "${cleanFieldName}" ${sqlType}
              `;
              await this.dataSource.query(alterTableSQLRetry);
              console.log(` Colonne ajoutée (sans NOT NULL): ${tableName}.${cleanFieldName}`);
            } else {
              console.error(` Erreur lors de l'ajout de la colonne ${tableName}.${cleanFieldName}:`, error);
              throw error;
            }
          }
        }
      } else {
        // Colonne existante : vérifier si elle doit être modifiée pour permettre NULL
        const hasDependency = field['x-dependsOn'] != null;
        const isRequired = schema.required?.includes(fieldName) ?? false;
        const shouldBeNullable = hasDependency || !isRequired;
        
        if (shouldBeNullable) {
          // Vérifier si la colonne a actuellement une contrainte NOT NULL
          const columnInfo = await this.dataSource.query(
            `SELECT is_nullable 
             FROM information_schema.columns 
             WHERE table_name = $1 
             AND column_name = $2 
             AND table_schema = 'public'`,
            [tableName, cleanFieldName],
          );
          
          if (columnInfo.length > 0 && columnInfo[0].is_nullable === 'NO') {
            // La colonne est NOT NULL mais devrait être nullable, la modifier
            const fieldType = field.type || 'string';
            const sqlType = this.getSqlType(fieldType, field.format);
            
            try {
              const alterTableSQL = `
                ALTER TABLE "${tableName}" 
                ALTER COLUMN "${cleanFieldName}" DROP NOT NULL
              `;
              await this.dataSource.query(alterTableSQL);
              console.log(` Contrainte NOT NULL supprimée pour: ${tableName}.${cleanFieldName}`);
            } catch (error) {
              console.warn(` Impossible de supprimer NOT NULL pour ${tableName}.${cleanFieldName}:`, error.message);
            }
          }
        }
      }
    }

    // Gérer les colonnes qui existent dans la table mais qui ne sont plus dans le schéma
    // (champs supprimés du formulaire) - les supprimer complètement
    const schemaFieldNames = new Set(
      Object.keys(properties).map(name => this.sanitizeFieldName(name).toLowerCase())
    );
    
    // Liste des colonnes système à ne jamais supprimer
    const systemColumns = new Set([
      'id', 'form_id', 'form_version', 'submission_id', 'campaign_id', 'prestataire_id',
      'status', 'presence_days', 'validation_date', 'kyc_status', 'approval_status',
      'approval_date', 'payment_status', 'payment_amount', 'payment_date', 'paid_at',
      'parent_submission_id', 'validation_sequence', 'created_at', 'updated_at', 'raw_data'
    ]);

    for (const col of existingColumns) {
      const columnName = col.column_name;
      const lowerColumnName = columnName.toLowerCase();
      
      // Ignorer les colonnes système
      if (systemColumns.has(lowerColumnName)) {
        continue;
      }
      
      // Si la colonne n'est plus dans le schéma, la supprimer complètement
      if (!schemaFieldNames.has(lowerColumnName)) {
        try {
          const dropColumnSQL = `
            ALTER TABLE "${tableName}" 
            DROP COLUMN IF EXISTS "${columnName}"
          `;
          await this.dataSource.query(dropColumnSQL);
          console.log(` Colonne obsolète supprimée: ${tableName}.${columnName} (champ supprimé du formulaire)`);
        } catch (error) {
          console.warn(` Impossible de supprimer la colonne obsolète ${tableName}.${columnName}:`, error.message);
        }
      }
    }
  }

  /**
   * Nettoie un nom de champ pour SQL (remplace les caractères spéciaux)
   */
  private sanitizeFieldName(fieldName: string): string {
    // Remplacer les caractères spéciaux par des underscores
    // PRÉSERVE LA CASSE pour respecter les noms comme provinceId, zoneId, etc.
    // PostgreSQL avec des guillemets ("provinceId") préserve la casse
    return fieldName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&'); // Ne peut pas commencer par un chiffre
    // NOTE: On ne convertit plus en minuscules pour préserver la casse
  }

  /**
   * Insère une soumission dans la table du formulaire
   */
  async insertSubmission(
    formId: string,
    formVersion: number,
    submissionId: string,
    data: Record<string, any>,
    campaignId?: string,
    prestataireId?: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    // Vérifier que la table existe
    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer les colonnes existantes dans la table
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les colonnes et valeurs (seulement les colonnes qui existent)
    const columns: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Colonne id (clé primaire) - générer au nouveau format ID-YYMM-HHmm-XXX
    if (existingColumnNames.has('id')) {
      const newId = await generateSubmissionId(this.dataSource, formId);
      columns.push('id');
      values.push(newId);
      paramIndex++;
    }

    // Colonnes de base
    if (existingColumnNames.has('submission_id')) {
      columns.push('submission_id');
      values.push(submissionId);
      paramIndex++;
    }
    if (existingColumnNames.has('form_id')) {
      columns.push('form_id');
      values.push(formId);
      paramIndex++;
    }
    if (existingColumnNames.has('form_version')) {
      columns.push('form_version');
      values.push(formVersion);
      paramIndex++;
    }
    if (existingColumnNames.has('raw_data')) {
      columns.push('raw_data');
      values.push(JSON.stringify(data));
      paramIndex++;
    }
    // campaign_id est maintenant requis pour la clé primaire composite
    // Si campaignId n'est pas fourni, récupérer la campagne active
    if (existingColumnNames.has('campaign_id')) {
      columns.push('campaign_id');
      let finalCampaignId = campaignId;
      
      if (!finalCampaignId) {
        // Récupérer la campagne active qui utilise ce formulaire
        try {
          const campaigns = await this.campaignsService.findAll();
          const activeCampaign = campaigns.find(c => c.isActive && c.enregistrementFormId === formId);
          if (activeCampaign) {
            finalCampaignId = activeCampaign.id;
            console.log(`[insertSubmission] Campagne active trouvée: ${activeCampaign.name} (${finalCampaignId})`);
          } else {
            // Si aucune campagne active, utiliser la première campagne qui utilise ce formulaire
            const campaignWithForm = campaigns.find(c => c.enregistrementFormId === formId);
            if (campaignWithForm) {
              finalCampaignId = campaignWithForm.id;
              console.log(`[insertSubmission] Campagne trouvée (non active): ${campaignWithForm.name} (${finalCampaignId})`);
            } else {
              throw new Error(`Aucune campagne trouvée pour le formulaire ${formId}. Veuillez spécifier campaignId ou créer une campagne active.`);
            }
          }
        } catch (error) {
          throw new Error(`Impossible de récupérer la campagne active: ${error.message}`);
        }
      }
      
      values.push(finalCampaignId);
      paramIndex++;
    }
    if (prestataireId && existingColumnNames.has('prestataire_id')) {
      columns.push('prestataire_id');
      values.push(prestataireId);
      paramIndex++;
    }

    // Ajouter les valeurs pour chaque champ du formulaire (seulement si la colonne existe)
    for (const [fieldName, value] of Object.entries(data)) {
      const cleanFieldName = this.sanitizeFieldName(fieldName);
      const lowerFieldName = cleanFieldName.toLowerCase();

      if (existingColumnNames.has(lowerFieldName)) {
        columns.push(`"${cleanFieldName}"`);
        
        // Convertir les valeurs selon leur type
        if (value === null || value === undefined) {
          values.push(null);
        } else if (typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (columns.length === 0) {
      throw new Error(`Aucune colonne valide trouvée dans la table ${tableName}`);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');

    // Utiliser INSERT simple car l'ID est généré de manière unique
    // Si un doublon existe (contrainte de clé primaire), cela générera une erreur qui sera gérée par l'appelant
    const insertSQL = `
      INSERT INTO "${tableName}" (${columnNames})
      VALUES (${placeholders})
    `;

    try {
      await this.dataSource.query(insertSQL, values);
    } catch (error: any) {
      // Si l'erreur est due à une violation de contrainte unique (doublon), mettre à jour l'enregistrement existant
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('UNIQUE constraint')) {
        // Récupérer l'ID de la valeur insérée
        const idIndex = columns.findIndex(col => col.toLowerCase() === 'id');
        const idValue = idIndex >= 0 ? values[idIndex] : null;
        
        if (idValue && existingColumnNames.has('raw_data')) {
          // Mettre à jour l'enregistrement existant
          const rawDataIndex = columns.findIndex(col => col.toLowerCase() === 'raw_data');
          const rawDataValue = rawDataIndex >= 0 ? values[rawDataIndex] : null;
          
          if (existingColumnNames.has('campaign_id')) {
            const campaignIdIndex = columns.findIndex(col => col.toLowerCase() === 'campaign_id');
            const campaignIdValue = campaignIdIndex >= 0 ? values[campaignIdIndex] : null;
            
            if (campaignIdValue) {
              await this.dataSource.query(
                `UPDATE "${tableName}" 
                 SET raw_data = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND campaign_id = $3`,
                [rawDataValue, idValue, campaignIdValue]
              );
              console.log(`[insertSubmission] Enregistrement mis à jour: id=${idValue}, campaign_id=${campaignIdValue}`);
            } else {
              await this.dataSource.query(
                `UPDATE "${tableName}" 
                 SET raw_data = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [rawDataValue, idValue]
              );
              console.log(`[insertSubmission] Enregistrement mis à jour: id=${idValue}`);
            }
          } else {
            await this.dataSource.query(
              `UPDATE "${tableName}" 
               SET raw_data = $1, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [rawDataValue, idValue]
            );
            console.log(`[insertSubmission] Enregistrement mis à jour: id=${idValue}`);
          }
        } else {
          // Si pas de raw_data, juste ignorer le doublon
          console.log(`[insertSubmission] Enregistrement déjà existant avec id=${idValue}, ignoré`);
        }
      } else {
        // Autre type d'erreur, propager
        throw error;
      }
    }
  }

  /**
   * Récupère les soumissions d'un formulaire
   */
  async getSubmissions(
    formId: string,
    page: number = 1,
    limit: number = 100,
    filters?: {
      status?: string;
      prestataireId?: string;
      campaignId?: string;
      validationSequence?: number | null;
      provinceId?: string;
      zoneId?: string;
      aireId?: string;
    },
  ): Promise<{ data: any[]; total: number }> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      console.log(`[getSubmissions] Table ${tableName} does not exist`);
      return { data: [], total: 0 };
    }

    // Vérifier combien d'enregistrements existent au total (sans filtre)
    const totalCountResult = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM "${tableName}"`,
    );
    console.log(`[getSubmissions] Total records in ${tableName}: ${totalCountResult[0]?.count || '0'}`);

    const offset = (page - 1) * limit;
    
    // Récupérer les colonnes existantes dans la table pour les filtres géographiques
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );
    const columnNames = new Set(existingColumns.map((col: any) => col.column_name.toLowerCase()));
    
    // Construire la clause WHERE dynamiquement
    let whereClause = '1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters) {
      if (filters.status !== undefined) {
        whereClause += ` AND status = $${paramIndex}`;
        queryParams.push(filters.status);
        paramIndex++;
      }
      if (filters.prestataireId) {
        // Chercher soit par id, soit par prestataire_id (selon la structure de la table)
        whereClause += ` AND (id = $${paramIndex} OR prestataire_id = $${paramIndex})`;
        queryParams.push(filters.prestataireId);
        paramIndex++;
      }
      if (filters.campaignId) {
        whereClause += ` AND campaign_id = $${paramIndex}`;
        queryParams.push(filters.campaignId);
        paramIndex++;
      }
      if (filters.validationSequence !== undefined) {
        if (filters.validationSequence === null) {
          whereClause += ` AND (validation_sequence IS NULL OR validation_sequence = 0)`;
        } else {
          whereClause += ` AND validation_sequence = $${paramIndex}`;
          queryParams.push(filters.validationSequence);
          paramIndex++;
        }
      }
      // Filtres géographiques - utiliser uniquement les colonnes qui existent réellement
      if (filters.provinceId) {
        const provinceColumns: string[] = [];
        // Chercher les variantes possibles de noms de colonnes pour province
        const possibleProvinceNames = ['provinceid', 'admin1_h_c', 'province_id', 'admin1', 'provinceId', 'ProvinceId', 'PROVINCEID'];
        for (const colName of possibleProvinceNames) {
          if (columnNames.has(colName.toLowerCase())) {
            // Trouver le nom exact avec la casse correcte
            const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName.toLowerCase())?.column_name;
            if (exactName) {
              provinceColumns.push(`"${exactName}"`);
            }
          }
        }
        if (provinceColumns.length > 0) {
          whereClause += ` AND (${provinceColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
          queryParams.push(filters.provinceId);
          paramIndex++;
          console.log(`[getSubmissions] Filtre provinceId appliqué: ${filters.provinceId} sur colonnes: ${provinceColumns.join(', ')}`);
        } else {
          // Si aucune colonne de province n'est trouvée, ne pas filtrer (pour éviter de perdre des données)
          console.warn(`[getSubmissions] ATTENTION: Aucune colonne de province trouvée dans ${tableName} pour filtrer par provinceId=${filters.provinceId}. Le filtre est ignoré pour retourner tous les prestataires.`);
        }
      }
      if (filters.zoneId) {
        const zoneColumns: string[] = [];
        // Chercher les variantes possibles de noms de colonnes pour zone
        // Ajouter aussi admin2_h_c qui est souvent utilisé dans les formulaires ODK
        const possibleZoneNames = ['zoneid', 'admin3_h_c', 'admin2_h_c', 'zone_id', 'admin3', 'admin2', 'zoneId', 'ZoneId', 'ZONEID'];
        for (const colName of possibleZoneNames) {
          if (columnNames.has(colName.toLowerCase())) {
            // Trouver le nom exact avec la casse correcte
            const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName.toLowerCase())?.column_name;
            if (exactName) {
              zoneColumns.push(`"${exactName}"`);
            }
          }
        }
        if (zoneColumns.length > 0) {
          whereClause += ` AND (${zoneColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
          queryParams.push(filters.zoneId);
          paramIndex++;
          console.log(`[getSubmissions] Filtre zoneId appliqué: ${filters.zoneId} sur colonnes: ${zoneColumns.join(', ')}`);
        } else {
          // Si aucune colonne de zone n'est trouvée, ne pas filtrer au niveau SQL
          // Le filtrage se fera côté application dans raw_data
          console.warn(`[getSubmissions] ATTENTION: Aucune colonne de zone trouvée dans ${tableName} pour filtrer par zoneId=${filters.zoneId}. Le filtre SQL est ignoré, le filtrage se fera côté application dans raw_data.`);
          console.log(`[getSubmissions] Colonnes disponibles dans ${tableName}:`, Array.from(columnNames).sort());
        }
      }
      if (filters.aireId) {
        const aireColumns: string[] = [];
        // Chercher les variantes possibles de noms de colonnes pour aire
        const possibleAireNames = ['aireid', 'admin4_h_c', 'aire_id', 'admin4', 'aireId', 'AireId', 'AIREID'];
        for (const colName of possibleAireNames) {
          if (columnNames.has(colName.toLowerCase())) {
            // Trouver le nom exact avec la casse correcte
            const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName.toLowerCase())?.column_name;
            if (exactName) {
              aireColumns.push(`"${exactName}"`);
            }
          }
        }
        if (aireColumns.length > 0) {
          whereClause += ` AND (${aireColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
          queryParams.push(filters.aireId);
          paramIndex++;
          console.log(`[getSubmissions] Filtre aireId appliqué: ${filters.aireId} sur colonnes: ${aireColumns.join(', ')}`);
        } else {
          // Si aucune colonne d'aire n'est trouvée, ne pas filtrer (pour éviter de perdre des données)
          console.warn(`[getSubmissions] ATTENTION: Aucune colonne d'aire trouvée dans ${tableName} pour filtrer par aireId=${filters.aireId}. Le filtre est ignoré pour retourner tous les prestataires.`);
        }
      }
    }

    console.log(`[getSubmissions] tableName=${tableName}, whereClause=${whereClause}, params=`, queryParams);

    // DIAGNOSTIC: Si on filtre par zoneId, vérifier d'abord combien d'enregistrements existent au total
    if (filters?.zoneId) {
      try {
        const totalCountQuery = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${tableName}" WHERE 1=1`,
        );
        const totalCount = parseInt(totalCountQuery[0]?.count || '0', 10);
        console.log(`[getSubmissions] DIAGNOSTIC: Total enregistrements dans ${tableName}: ${totalCount}`);
        
        // Échantillonner quelques enregistrements pour voir les zoneIds présents
        if (totalCount > 0) {
          const sampleQuery = await this.dataSource.query(
            `SELECT * FROM "${tableName}" LIMIT 5`,
          );
          const sampleZoneIds = new Set<string>();
          sampleQuery.forEach((record: any) => {
            const rawData = typeof record.raw_data === 'string' 
              ? (() => {
                  try {
                    return JSON.parse(record.raw_data || '{}');
                  } catch (e) {
                    return {};
                  }
                })()
              : (record.raw_data || {});
            
            const sampleZoneId = record.zone_id || 
                                record.zoneId || 
                                record.zone_de_sante_id ||
                                record.zoneDeSanteId ||
                                rawData.zone_id || 
                                rawData.zoneId || 
                                rawData.zone_de_sante_id ||
                                rawData.zoneDeSanteId ||
                                rawData.admin2_h_c ||
                                rawData.admin3_h_c ||
                                record.admin2_h_c ||
                                record.admin3_h_c;
            
            if (sampleZoneId) {
              sampleZoneIds.add(sampleZoneId.toString().trim().toLowerCase());
            }
          });
          console.log(`[getSubmissions] DIAGNOSTIC: ZoneIds trouvés dans l'échantillon (5 premiers):`, Array.from(sampleZoneIds));
        }
      } catch (e) {
        console.warn(`[getSubmissions] Erreur lors du diagnostic:`, e);
      }
    }

    // Récupérer toutes les données d'abord (sans filtres géographiques si les colonnes n'existent pas)
    const [data, countResult] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${tableName}" WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset],
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`,
        queryParams,
      ),
    ]);

    console.log(`[getSubmissions] found ${data.length} records before geographic filtering, total=${countResult[0]?.count || '0'}`);

    // Si des filtres géographiques ont été demandés mais aucune colonne n'a été trouvée,
    // appliquer le filtre sur raw_data après récupération
    let filteredData = data;
    let filteredTotal = parseInt(countResult[0]?.count || '0', 10);
    
    if (filters) {
      // Filtrer par zoneId dans raw_data si nécessaire
      if (filters.zoneId && columnNames.has('raw_data')) {
        const zoneColumnsFound = existingColumns.some((col: any) => {
          const colName = col.column_name.toLowerCase();
          return ['zoneid', 'admin3_h_c', 'admin2_h_c', 'zone_id', 'admin3', 'admin2'].includes(colName);
        });
        
        // Si le filtre SQL n'a rien retourné mais qu'une colonne existe, récupérer TOUS les enregistrements
        // et filtrer dans raw_data (les données peuvent être dans raw_data mais pas dans la colonne)
        if (zoneColumnsFound && data.length === 0) {
          console.log(`[getSubmissions] Filtre SQL n'a rien retourné malgré colonne existante, récupération de tous les enregistrements pour filtrage dans raw_data`);
          const allDataQuery = await this.dataSource.query(
            `SELECT * FROM "${tableName}" WHERE 1=1 ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
            [limit, offset],
          );
          filteredData = allDataQuery;
          console.log(`[getSubmissions] ${allDataQuery.length} enregistrements récupérés pour filtrage dans raw_data`);
        }
        
        // Filtrer dans raw_data si aucune colonne n'a été trouvée OU si le filtre SQL n'a rien retourné
        const shouldFilterInRawData = !zoneColumnsFound || (zoneColumnsFound && data.length === 0);
        
        if (shouldFilterInRawData) {
          if (!zoneColumnsFound) {
            console.log(`[getSubmissions] Colonne zone non trouvée, filtrage dans raw_data pour zoneId=${filters.zoneId}`);
          } else {
            console.log(`[getSubmissions] Filtre SQL n'a rien retourné, filtrage dans raw_data pour zoneId=${filters.zoneId}`);
          }
          const normalizedZoneId = filters.zoneId.toString().trim().toLowerCase();
          
          let matchCount = 0;
          let noZoneIdCount = 0;
          const uniqueZoneIdsFound = new Set<string>();
          
          filteredData = filteredData.filter((record: any) => {
            // Parser raw_data si c'est une string
            const rawData = typeof record.raw_data === 'string' 
              ? (() => {
                  try {
                    return JSON.parse(record.raw_data || '{}');
                  } catch (e) {
                    console.warn(`[getSubmissions] Erreur parsing raw_data:`, e);
                    return {};
                  }
                })()
              : (record.raw_data || {});
            
            // Chercher dans plusieurs emplacements possibles (ordre de priorité)
            const recordZoneId = record.zone_id || 
                                record.zoneId || 
                                record.zone_de_sante_id ||
                                record.zoneDeSanteId ||
                                rawData.zone_id || 
                                rawData.zoneId || 
                                rawData.zone_de_sante_id ||
                                rawData.zoneDeSanteId ||
                                rawData.admin2_h_c ||
                                rawData.admin3_h_c ||
                                record.admin2_h_c ||
                                record.admin3_h_c;
            
            if (!recordZoneId) {
              noZoneIdCount++;
              return false; // ❌ CORRECTION: Exclure si pas de zoneId quand on filtre par zoneId
            }
            
            // Normaliser pour comparaison
            const normalizedRecordZoneId = recordZoneId.toString().trim().toLowerCase();
            uniqueZoneIdsFound.add(normalizedRecordZoneId);
            
            const matches = normalizedRecordZoneId === normalizedZoneId;
            if (matches) {
              matchCount++;
            }
            
            return matches;
          });
          
          console.log(`[getSubmissions] Après filtrage dans raw_data: ${filteredData.length} enregistrements (${matchCount} matches, ${noZoneIdCount} sans zoneId)`);
          console.log(`[getSubmissions] ZoneIds uniques trouvés dans raw_data:`, Array.from(uniqueZoneIdsFound));
          
          if (filteredData.length === 0 && data.length > 0) {
            console.warn(`[getSubmissions] ⚠️ ATTENTION: Aucun match trouvé pour zoneId="${filters.zoneId}" (normalisé: "${normalizedZoneId}")`);
            console.warn(`[getSubmissions] ZoneIds disponibles dans les données:`, Array.from(uniqueZoneIdsFound));
          }
          
          // Recompter le total
          const allDataForCount = await this.dataSource.query(
            `SELECT * FROM "${tableName}" WHERE ${whereClause.replace(/AND\s+\([^)]*zone[^)]*\)/gi, '')}`,
            queryParams.filter((_, idx) => {
              // Retirer les paramètres de zoneId
              return true; // Simplifié pour l'instant
            }),
          );
          
          filteredTotal = allDataForCount.filter((record: any) => {
            const rawData = typeof record.raw_data === 'string' 
              ? JSON.parse(record.raw_data) 
              : (record.raw_data || {});
            
            const recordZoneId = record.zone_id || 
                                record.zoneId || 
                                rawData.zone_id || 
                                rawData.zoneId || 
                                rawData.admin3_h_c ||
                                record.admin3_h_c;
            
            if (!recordZoneId) return true;
            
            return recordZoneId.toString().trim().toLowerCase() === normalizedZoneId;
          }).length;
          
          console.log(`[getSubmissions] Après filtrage raw_data zoneId: ${filteredData.length} enregistrements, total=${filteredTotal}`);
        }
      }
      
      // Vérifier si on doit filtrer par aireId dans raw_data
      if (filters.aireId) {
        const aireColumnsFound = existingColumns.some((col: any) => {
          const colName = col.column_name.toLowerCase();
          return ['aireid', 'admin4_h_c', 'aire_id', 'admin4'].includes(colName);
        });
        
        if (!aireColumnsFound && columnNames.has('raw_data')) {
          console.log(`[getSubmissions] Colonne aire non trouvée, filtrage dans raw_data pour aireId=${filters.aireId}`);
          const normalizedAireId = filters.aireId.toString().trim().toLowerCase();
          
          filteredData = filteredData.filter((record: any) => {
            const rawData = typeof record.raw_data === 'string' 
              ? JSON.parse(record.raw_data) 
              : (record.raw_data || {});
            
            const recordAireId = record.aire_id || 
                                 record.aireId || 
                                 rawData.aire_id || 
                                 rawData.aireId || 
                                 rawData.admin4_h_c ||
                                 record.admin4_h_c;
            
            if (!recordAireId) return true; // Inclure si pas d'aireId
            
            return recordAireId.toString().trim().toLowerCase() === normalizedAireId;
          });
          
          console.log(`[getSubmissions] Après filtrage raw_data aireId: ${filteredData.length} enregistrements`);
        }
      }
      
      // Vérifier si on doit filtrer par provinceId dans raw_data
      if (filters.provinceId) {
        const provinceColumnsFound = existingColumns.some((col: any) => {
          const colName = col.column_name.toLowerCase();
          return ['provinceid', 'admin1_h_c', 'province_id', 'admin1'].includes(colName);
        });
        
        if (!provinceColumnsFound && columnNames.has('raw_data')) {
          console.log(`[getSubmissions] Colonne province non trouvée, filtrage dans raw_data pour provinceId=${filters.provinceId}`);
          const normalizedProvinceId = filters.provinceId.toString().trim().toLowerCase();
          
          filteredData = filteredData.filter((record: any) => {
            const rawData = typeof record.raw_data === 'string' 
              ? JSON.parse(record.raw_data) 
              : (record.raw_data || {});
            
            const recordProvinceId = record.province_id || 
                                     record.provinceId || 
                                     rawData.province_id || 
                                     rawData.provinceId || 
                                     rawData.admin1_h_c ||
                                     record.admin1_h_c;
            
            if (!recordProvinceId) return true; // Inclure si pas de provinceId
            
            return recordProvinceId.toString().trim().toLowerCase() === normalizedProvinceId;
          });
          
          console.log(`[getSubmissions] Après filtrage raw_data provinceId: ${filteredData.length} enregistrements`);
        }
      }
    }

    console.log(`[getSubmissions] found ${filteredData.length} records after all filtering, total=${filteredTotal}`);

    return {
      data: filteredData,
      total: filteredTotal,
    };
  }

  /**
   * Met à jour le prestataire_id dans une soumission existante
   */
  async updateSubmissionPrestataireId(
    formId: string,
    submissionId: string,
    prestataireId: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas.`);
    }

    // Vérifier que la colonne prestataire_id existe
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'
       AND column_name = 'prestataire_id'`,
      [tableName],
    );

    if (existingColumns.length === 0) {
      // La colonne n'existe pas, on ne fait rien
      return;
    }

    await this.dataSource.query(
      `UPDATE "${tableName}" 
       SET prestataire_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE submission_id = $2`,
      [prestataireId, submissionId],
    );
  }

  /**
   * Met à jour directement la validation dans la table du formulaire
   * Utilise l'ID du prestataire (id dans la table form_*) pour identifier l'enregistrement
   */
  async updateValidationInTable(
    formId: string,
    prestataireId: string,
    presenceDays: number,
    validationDate?: string,
    campaignId?: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Mettre à jour presence_days
    if (existingColumnNames.has('presence_days')) {
      updates.push(`presence_days = $${paramIndex}`);
      values.push(presenceDays);
      paramIndex++;
    }

    // Mettre à jour validation_status (statut spécifique de validation IT)
    if (existingColumnNames.has('validation_status')) {
      updates.push(`validation_status = $${paramIndex}`);
      values.push('VALIDE_PAR_IT');
      paramIndex++;
    }

    // Mettre à jour status (statut global pour compatibilité)
    if (existingColumnNames.has('status')) {
      updates.push(`status = $${paramIndex}`);
      values.push('VALIDE_PAR_IT');
      paramIndex++;
    }

    // Mettre à jour validation_date
    if (validationDate && existingColumnNames.has('validation_date')) {
      updates.push(`validation_date = $${paramIndex}`);
      values.push(validationDate);
      paramIndex++;
    }

    // Mettre à jour campaign_id si fourni
    if (campaignId && existingColumnNames.has('campaign_id')) {
      updates.push(`campaign_id = $${paramIndex}`);
      values.push(campaignId);
      paramIndex++;
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      throw new Error(`Aucune colonne de validation trouvée dans la table ${tableName}`);
    }

    if (!campaignId) {
      throw new Error(`campaignId est requis pour mettre à jour une validation`);
    }

    // Utiliser id et campaign_id pour identifier la ligne (clé primaire composite)
    values.push(prestataireId);
    values.push(campaignId);

    const updateSQL = `
      UPDATE "${tableName}" 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND campaign_id = $${paramIndex + 1}
    `;

    await this.dataSource.query(updateSQL, values);
    console.log(`✅ Validation mise à jour pour prestataire ${prestataireId} dans la table ${tableName}`);
  }

  /**
   * Met à jour l'invalidation dans la table du formulaire
   * Réinitialise validation_status et status à ENREGISTRE
   */
  async updateInvalidationInTable(
    formId: string,
    prestataireId: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Mettre à jour validation_status (statut spécifique de validation IT)
    if (existingColumnNames.has('validation_status')) {
      updates.push(`validation_status = $${paramIndex}`);
      values.push('ENREGISTRE');
      paramIndex++;
    }

    // Mettre à jour status (statut global pour compatibilité)
    if (existingColumnNames.has('status')) {
      updates.push(`status = $${paramIndex}`);
      values.push('ENREGISTRE');
      paramIndex++;
    }

    // Optionnel: mettre presence_days à null
    if (existingColumnNames.has('presence_days')) {
      updates.push(`presence_days = NULL`);
    }

    // Optionnel: mettre validation_date à null
    if (existingColumnNames.has('validation_date')) {
      updates.push(`validation_date = NULL`);
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      throw new Error(`Aucune colonne trouvée dans la table ${tableName}`);
    }

    // Utiliser id pour identifier la ligne
    values.push(prestataireId);

    const updateSQL = `
      UPDATE "${tableName}" 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.dataSource.query(updateSQL, values);
    console.log(`✅ Invalidation mise à jour pour prestataire ${prestataireId} dans la table ${tableName}`);
  }

  /**
   * Met à jour les informations d'un prestataire dans la table du formulaire
   */
  async updatePrestataireInTable(
    formId: string,
    prestataireId: string,
    updateData: Partial<{
      nom: string;
      prenom: string;
      postnom: string;
      telephone: string;
      categorie: string;
    }>,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Mapper les champs vers les colonnes du formulaire
    const fieldMapping: Record<string, string[]> = {
      nom: ['family_name_i_c', 'family_name', 'nom'],
      prenom: ['given_name_i_c', 'given_name', 'prenom'],
      postnom: ['middle_name_i_c', 'middle_name', 'postnom'],
      telephone: ['num_phone', 'confirm_phone', 'telephone'],
      categorie: ['categorie', 'category'],
    };

    for (const [key, value] of Object.entries(updateData)) {
      if (value === undefined) continue;

      const possibleColumns = fieldMapping[key] || [key];
      let columnFound = false;

      for (const colName of possibleColumns) {
        if (existingColumnNames.has(colName.toLowerCase())) {
          updates.push(`"${colName}" = $${paramIndex}`);
          values.push(value || null);
          paramIndex++;
          columnFound = true;
          break;
        }
      }
    }

    // Mettre à jour raw_data si nécessaire
    if (Object.keys(updateData).length > 0 && existingColumnNames.has('raw_data')) {
      // Récupérer l'enregistrement actuel
      const currentRecord = await this.dataSource.query(
        `SELECT raw_data FROM "${tableName}" WHERE id = $1`,
        [prestataireId],
      );

      if (currentRecord && currentRecord.length > 0) {
        const rawData = currentRecord[0].raw_data || {};
        
        // Mettre à jour les champs dans raw_data
        for (const [key, value] of Object.entries(updateData)) {
          if (value !== undefined) {
            rawData[key] = value;
          }
        }

        updates.push(`raw_data = $${paramIndex}`);
        values.push(JSON.stringify(rawData));
        paramIndex++;
      }
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      throw new Error(`Aucune colonne trouvée pour la mise à jour dans la table ${tableName}`);
    }

    // Utiliser id pour identifier la ligne
    values.push(prestataireId);

    const updateSQL = `
      UPDATE "${tableName}" 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.dataSource.query(updateSQL, values);
    console.log(`✅ Prestataire ${prestataireId} mis à jour dans la table ${tableName}`);
  }

  /**
   * Récupère la soumission originale d'un prestataire
   */
  async getOriginalSubmission(
    formId: string,
    prestataireId: string,
  ): Promise<any | null> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      return null;
    }

    // Utiliser id (qui est l'ID du prestataire) pour trouver l'enregistrement original
    // L'enregistrement original est celui sans validation_sequence (ou validation_sequence = 0)
    const result = await this.dataSource.query(
      `SELECT * FROM "${tableName}" 
       WHERE id = $1 
       AND (validation_sequence IS NULL OR validation_sequence = 0)
       AND (parent_submission_id IS NULL OR parent_submission_id = '')
       ORDER BY created_at ASC 
       LIMIT 1`,
      [prestataireId],
    );

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Récupère toutes les validations d'un prestataire (y compris l'enregistrement original)
   */
  async getPrestataireValidations(
    formId: string,
    prestataireId: string,
  ): Promise<any[]> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      return [];
    }

    // Utiliser id (qui est l'ID du prestataire) pour l'enregistrement original
    // et prestataire_id pour les validations (qui ont parent_submission_id)
    return this.dataSource.query(
      `SELECT * FROM "${tableName}" 
       WHERE id = $1 OR prestataire_id = $1
       ORDER BY validation_sequence ASC NULLS FIRST, created_at ASC`,
      [prestataireId],
    );
  }

  /**
   * Récupère le prochain numéro de séquence de validation pour un prestataire
   */
  private async getNextValidationSequence(
    tableName: string,
    prestataireId: string,
  ): Promise<number> {
    // Utiliser id (qui est l'ID du prestataire) au lieu de prestataire_id
    const result = await this.dataSource.query(
      `SELECT COALESCE(MAX(validation_sequence), 0) + 1 as next_sequence
       FROM "${tableName}" 
       WHERE id = $1 OR prestataire_id = $1`,
      [prestataireId],
    );

    return parseInt(result[0]?.next_sequence || '1', 10);
  }

  /**
   * Insère un nouvel enregistrement de validation dans la table dynamique
   * Crée une nouvelle ligne avec les données de la soumission originale + les nouvelles données de validation
   */
  async insertValidationRecord(
    formId: string,
    prestataireId: string,
    campaignId: string,
    validationDate: string,
    presenceDays: number,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    // Vérifier que la table existe
    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer la soumission originale
    const originalSubmission = await this.getOriginalSubmission(formId, prestataireId);
    if (!originalSubmission) {
      console.error(`[insertValidationRecord] Aucune soumission originale trouvée pour prestataireId=${prestataireId}, formId=${formId}`);
      // Essayer de trouver n'importe quel enregistrement avec cet ID
      const anyRecord = await this.dataSource.query(
        `SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`,
        [prestataireId],
      );
      if (anyRecord.length > 0) {
        console.log(`[insertValidationRecord] Enregistrement trouvé mais pas original:`, anyRecord[0]);
      } else {
        console.error(`[insertValidationRecord] Aucun enregistrement trouvé avec id=${prestataireId}`);
      }
      throw new Error(`Aucune soumission originale trouvée pour le prestataire ${prestataireId}. Assurez-vous que le prestataire a été enregistré via le formulaire.`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Vérifier si une validation existe déjà pour ce prestataire et cette campagne
    const existingValidation = await this.findValidationByCampaign(formId, prestataireId, campaignId);
    if (existingValidation) {
      throw new Error(`Une validation existe déjà pour ce prestataire (ID: ${prestataireId}) et cette campagne (ID: ${campaignId}). Veuillez modifier la validation existante ou choisir une autre campagne.`);
    }

    // Générer un nouveau submission_id
    const timestamp = Date.now();
    const newSubmissionId = `${originalSubmission.submission_id}_validation_${campaignId}_${timestamp}`;

    // Récupérer le prochain numéro de séquence
    const validationSequence = await this.getNextValidationSequence(tableName, prestataireId);

    // Utiliser le même ID du prestataire (pas de nouvel ID)
    const prestataireIdValue = prestataireId;

    // Préparer les colonnes et valeurs
    const columns: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Colonne id - utiliser le même ID du prestataire
    if (existingColumnNames.has('id')) {
      columns.push('id');
      values.push(prestataireIdValue);
      paramIndex++;
    }

    // Colonnes de base
    if (existingColumnNames.has('submission_id')) {
      columns.push('submission_id');
      values.push(newSubmissionId);
      paramIndex++;
    }
    if (existingColumnNames.has('form_id')) {
      columns.push('form_id');
      values.push(formId);
      paramIndex++;
    }
    if (existingColumnNames.has('form_version')) {
      columns.push('form_version');
      values.push(originalSubmission.form_version);
      paramIndex++;
    }
    if (existingColumnNames.has('prestataire_id')) {
      columns.push('prestataire_id');
      values.push(prestataireId);
      paramIndex++;
    }
    // campaign_id est REQUIS pour la clé primaire composite
    if (existingColumnNames.has('campaign_id')) {
      columns.push('campaign_id');
      values.push(campaignId);
      paramIndex++;
    } else {
      throw new Error(`La colonne campaign_id est requise dans la table ${tableName} pour créer une validation`);
    }
    // Mettre à jour validation_status (statut spécifique de validation IT)
    if (existingColumnNames.has('validation_status')) {
      columns.push('validation_status');
      values.push('VALIDE_PAR_IT');
      paramIndex++;
    }
    // Mettre à jour status (statut global pour compatibilité)
    if (existingColumnNames.has('status')) {
      columns.push('status');
      values.push('VALIDE_PAR_IT');
      paramIndex++;
    }
    if (existingColumnNames.has('presence_days')) {
      columns.push('presence_days');
      values.push(presenceDays);
      paramIndex++;
    }
    if (existingColumnNames.has('validation_date')) {
      columns.push('validation_date');
      values.push(validationDate);
      paramIndex++;
    }
    if (existingColumnNames.has('parent_submission_id')) {
      columns.push('parent_submission_id');
      values.push(originalSubmission.submission_id);
      paramIndex++;
    }
    if (existingColumnNames.has('validation_sequence')) {
      columns.push('validation_sequence');
      values.push(validationSequence);
      paramIndex++;
    }
    if (existingColumnNames.has('raw_data')) {
      columns.push('raw_data');
      values.push(originalSubmission.raw_data || JSON.stringify({}));
      paramIndex++;
    }

    // Créer un Set pour suivre les colonnes déjà ajoutées (sans guillemets, en minuscules)
    const addedColumns = new Set<string>();
    
    // Ajouter les colonnes déjà ajoutées (système, statuts, etc.)
    columns.forEach(col => {
      const colName = col.replace(/"/g, '').toLowerCase();
      addedColumns.add(colName);
    });

    // Copier toutes les données du formulaire depuis la soumission originale
    if (originalSubmission.raw_data) {
      const originalData = typeof originalSubmission.raw_data === 'string' 
        ? JSON.parse(originalSubmission.raw_data) 
        : originalSubmission.raw_data;

      for (const [fieldName, value] of Object.entries(originalData)) {
        const cleanFieldName = this.sanitizeFieldName(fieldName);
        const lowerFieldName = cleanFieldName.toLowerCase();

        // Vérifier que la colonne existe ET qu'elle n'a pas déjà été ajoutée
        if (existingColumnNames.has(lowerFieldName) && !addedColumns.has(lowerFieldName)) {
          columns.push(`"${cleanFieldName}"`);
          addedColumns.add(lowerFieldName);
          
          if (value === null || value === undefined) {
            values.push(null);
          } else if (typeof value === 'object') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
          paramIndex++;
        }
      }
    }

    // Copier aussi les colonnes directes de la soumission originale (seulement si pas déjà dans raw_data)
    for (const [key, value] of Object.entries(originalSubmission)) {
      // Ignorer les colonnes système et celles déjà traitées
      if (key === 'id' || key === 'submission_id' || key === 'created_at' || key === 'updated_at' ||
          key === 'raw_data' || key === 'form_id' || key === 'form_version' ||
          key === 'campaign_id' || key === 'prestataire_id' || key === 'status' ||
          key === 'presence_days' || key === 'validation_date' || key === 'parent_submission_id' ||
          key === 'validation_sequence') {
        continue;
      }

      const lowerKey = key.toLowerCase();
      // Vérifier que la colonne existe ET qu'elle n'a pas déjà été ajoutée
      if (existingColumnNames.has(lowerKey) && !addedColumns.has(lowerKey)) {
        const cleanKey = key.replace(/"/g, '');
        columns.push(`"${cleanKey}"`);
        addedColumns.add(lowerKey);
        
        if (value === null || value === undefined) {
          values.push(null);
        } else if (typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (columns.length === 0) {
      throw new Error(`Aucune colonne valide trouvée dans la table ${tableName}`);
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');

    // Utiliser INSERT simple, gérer les doublons avec try/catch
    const insertSQL = `
      INSERT INTO "${tableName}" (${columnNames})
      VALUES (${placeholders})
    `;

    try {
      await this.dataSource.query(insertSQL, values);
      console.log(`✅ Enregistrement de validation créé: ${newSubmissionId} pour prestataire ${prestataireId} et campagne ${campaignId}`);
    } catch (error: any) {
      // Si l'erreur est due à une contrainte unique (doublon), mettre à jour l'enregistrement existant
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('UNIQUE constraint')) {
        // Récupérer les index des colonnes à mettre à jour
        const statusIndex = columns.findIndex(col => col.toLowerCase() === 'status');
        const presenceDaysIndex = columns.findIndex(col => col.toLowerCase() === 'presence_days');
        const validationDateIndex = columns.findIndex(col => col.toLowerCase() === 'validation_date');
        const idIndex = columns.findIndex(col => col.toLowerCase() === 'id');
        const campaignIdIndex = columns.findIndex(col => col.toLowerCase() === 'campaign_id');
        
        const idValue = idIndex >= 0 ? values[idIndex] : newSubmissionId;
        const campaignIdValue = campaignIdIndex >= 0 ? values[campaignIdIndex] : campaignId;
        
        // Construire la mise à jour
        const updates: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;
        
        if (statusIndex >= 0) {
          updates.push(`status = $${paramIndex}`);
          updateValues.push(values[statusIndex]);
          paramIndex++;
        }
        if (presenceDaysIndex >= 0) {
          updates.push(`presence_days = $${paramIndex}`);
          updateValues.push(values[presenceDaysIndex]);
          paramIndex++;
        }
        if (validationDateIndex >= 0) {
          updates.push(`validation_date = $${paramIndex}`);
          updateValues.push(values[validationDateIndex]);
          paramIndex++;
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        
        // Identifier l'enregistrement par id et campaign_id
        updateValues.push(idValue);
        updateValues.push(campaignIdValue);
        
        await this.dataSource.query(
          `UPDATE "${tableName}" 
           SET ${updates.join(', ')}
           WHERE id = $${paramIndex} AND campaign_id = $${paramIndex + 1}`,
          updateValues
        );
        console.log(`✅ Enregistrement de validation mis à jour: ${newSubmissionId} pour prestataire ${prestataireId} et campagne ${campaignId}`);
      } else {
        // Autre type d'erreur, propager
        throw error;
      }
    }
  }

  /**
   * Trouve une validation existante pour un prestataire et une campagne donnés
   */
  async findValidationByCampaign(
    formId: string,
    prestataireId: string,
    campaignId?: string,
  ): Promise<any | null> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      return null;
    }

    if (!campaignId) {
      return null;
    }

    // Chercher une validation existante pour ce prestataire et cette campagne
    // Pour les validations, on utilise prestataire_id pour référencer le prestataire original
    // Vérifier à la fois par id et prestataire_id, et chercher les validations par:
    // - status = 'VALIDE_PAR_IT' OU
    // - validation_sequence IS NOT NULL OU
    // - presence_days IS NOT NULL (indique qu'une validation a été faite)
    const result = await this.dataSource.query(
      `SELECT * FROM "${tableName}" 
       WHERE (id = $1 OR prestataire_id = $1)
       AND campaign_id = $2
       AND (
         status = 'VALIDE_PAR_IT' 
         OR validation_sequence IS NOT NULL 
         OR presence_days IS NOT NULL
       )
       ORDER BY validation_sequence DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [prestataireId, campaignId],
    );

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Récupère la dernière validation d'un prestataire (ou l'enregistrement original si pas de validation)
   */
  private async getLastValidationOrOriginal(
    formId: string,
    prestataireId: string,
  ): Promise<any | null> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      return null;
    }

    // Chercher d'abord la dernière validation (avec validation_sequence le plus élevé)
    // Utiliser id pour l'enregistrement original et prestataire_id pour les validations
    const lastValidation = await this.dataSource.query(
      `SELECT * FROM "${tableName}" 
       WHERE (id = $1 OR prestataire_id = $1)
       AND validation_sequence IS NOT NULL
       ORDER BY validation_sequence DESC 
       LIMIT 1`,
      [prestataireId],
    );

    if (lastValidation.length > 0) {
      return lastValidation[0];
    }

    // Sinon, retourner l'enregistrement original
    return await this.getOriginalSubmission(formId, prestataireId);
  }

  /**
   * Met à jour la ligne de validation avec les données d'approbation
   * Met à jour la validation correspondant à la campagne (ou la dernière validation si campaignId non fourni)
   */
  async updateApprovalInTable(
    formId: string,
    prestataireId: string,
    approvalStatus: string,
    approvalDate: string,
    commentaire?: string,
    campaignId?: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer la validation correspondant à la campagne si fournie, sinon la dernière validation
    let baseRecord: any | null = null;
    if (campaignId) {
      baseRecord = await this.findValidationByCampaign(formId, prestataireId, campaignId);
    }
    
    // Si pas trouvé par campagne, utiliser la dernière validation ou l'enregistrement original
    if (!baseRecord) {
      baseRecord = await this.getLastValidationOrOriginal(formId, prestataireId);
    }
    
    if (!baseRecord) {
      throw new Error(`Aucun enregistrement trouvé pour le prestataire ${prestataireId}`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Mettre à jour approval_status (statut spécifique d'approbation MCZ)
    if (existingColumnNames.has('approval_status')) {
      updates.push(`approval_status = $${paramIndex}`);
      values.push(approvalStatus === 'APPROVED' ? 'APPROUVE_PAR_MCZ' : 'REJETE_PAR_MCZ');
      paramIndex++;
    }

    // Mettre à jour approval_date
    if (existingColumnNames.has('approval_date')) {
      updates.push(`approval_date = $${paramIndex}`);
      values.push(approvalDate);
      paramIndex++;
    }

    // Mettre à jour le status global pour compatibilité (basé sur le dernier statut)
    if (existingColumnNames.has('status')) {
      updates.push(`status = $${paramIndex}`);
      values.push(approvalStatus === 'APPROVED' ? 'APPROUVE_PAR_MCZ' : 'REJETE_PAR_MCZ');
      paramIndex++;
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      throw new Error(`Aucune colonne d'approbation trouvée dans la table ${tableName}`);
    }

    // Utiliser id (clé primaire) pour identifier la ligne à mettre à jour
    values.push(baseRecord.id);

    const updateSQL = `
      UPDATE "${tableName}" 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.dataSource.query(updateSQL, values);
    console.log(`✅ Enregistrement d'approbation mis à jour pour prestataire ${prestataireId}`);
  }

  /**
   * Met à jour la ligne de validation avec les données de paiement
   * Met à jour la validation correspondant à la campagne (ou la dernière validation si campaignId non fourni)
   */
  async updatePaymentInTable(
    formId: string,
    prestataireId: string,
    paymentStatus: string,
    paymentAmount: number,
    paymentDate: string,
    transactionId?: string,
    campaignId?: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer la validation correspondant à la campagne si fournie, sinon la dernière validation
    let baseRecord: any | null = null;
    if (campaignId) {
      baseRecord = await this.findValidationByCampaign(formId, prestataireId, campaignId);
    }
    
    // Si pas trouvé par campagne, utiliser la dernière validation ou l'enregistrement original
    if (!baseRecord) {
      baseRecord = await this.getLastValidationOrOriginal(formId, prestataireId);
    }
    
    if (!baseRecord) {
      throw new Error(`Aucun enregistrement trouvé pour le prestataire ${prestataireId}`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // NE PAS modifier la colonne 'status' qui doit rester 'APPROUVE_PAR_MCZ' pour les prestataires approuvés
    // Seulement mettre à jour payment_status, payment_amount, payment_date, etc.
    
    // Mettre à jour payment_status
    if (existingColumnNames.has('payment_status')) {
      updates.push(`payment_status = $${paramIndex}`);
      values.push(paymentStatus);
      paramIndex++;
    }

    // Mettre à jour payment_amount
    if (existingColumnNames.has('payment_amount')) {
      updates.push(`payment_amount = $${paramIndex}`);
      values.push(paymentAmount);
      paramIndex++;
    }

    // Mettre à jour payment_date
    if (existingColumnNames.has('payment_date')) {
      updates.push(`payment_date = $${paramIndex}`);
      values.push(paymentDate);
      paramIndex++;
    }

    // Mettre à jour paid_at si le paiement est effectué
    if (existingColumnNames.has('paid_at') && paymentStatus === 'PAID') {
      updates.push(`paid_at = $${paramIndex}`);
      values.push(paymentDate);
      paramIndex++;
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      throw new Error(`Aucune colonne de paiement trouvée dans la table ${tableName}`);
    }

    // Utiliser id (clé primaire) pour identifier la ligne à mettre à jour
    values.push(baseRecord.id);

    const updateSQL = `
      UPDATE "${tableName}" 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `;

    await this.dataSource.query(updateSQL, values);
    console.log(` Enregistrement de paiement mis à jour pour prestataire ${prestataireId}`);
  }

  /**
   * Met à jour la ligne de validation avec les données KYC
   * Met à jour la dernière validation (ou l'enregistrement original) au lieu de créer une nouvelle ligne
   * Si le numéro de téléphone change, crée une nouvelle ligne
   */
  async updateKycInTable(
    formId: string,
    prestataireId: string,
    kycStatus: string,
    telephone?: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer la dernière validation ou l'enregistrement original
    const baseRecord = await this.getLastValidationOrOriginal(formId, prestataireId);
    if (!baseRecord) {
      throw new Error(`Aucun enregistrement trouvé pour le prestataire ${prestataireId}`);
    }

    // Vérifier si le numéro de téléphone a changé
    const existingTelephone = baseRecord.telephone || baseRecord.raw_data?.telephone;
    const telephoneChanged = telephone && existingTelephone && telephone !== existingTelephone;

    // Note: Le statut KYC peut être mis à jour même si le numéro ne change pas
    // (par exemple, lorsque le partenaire vérifie le KYC et importe les résultats)

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Mettre à jour kyc_status (toujours, car c'est une vérification manuelle par le partenaire)
    if (existingColumnNames.has('kyc_status')) {
      updates.push(`kyc_status = $${paramIndex}`);
      values.push(kycStatus);
      paramIndex++;
    }

    // Mettre à jour kyc_date (date de vérification KYC)
    if (existingColumnNames.has('kyc_date')) {
      updates.push(`kyc_date = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;
    }
    
    // Si le téléphone est fourni et a changé, le mettre à jour
    if (telephone && telephoneChanged && existingColumnNames.has('telephone')) {
      updates.push(`telephone = $${paramIndex}`);
      values.push(telephone);
      paramIndex++;
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      throw new Error(`Aucune colonne KYC trouvée dans la table ${tableName}`);
    }

    // Utiliser submission_id pour identifier la ligne à mettre à jour
    values.push(baseRecord.submission_id);

    const updateSQL = `
      UPDATE "${tableName}" 
      SET ${updates.join(', ')}
      WHERE submission_id = $${paramIndex}
    `;

    await this.dataSource.query(updateSQL, values);
    console.log(` Enregistrement KYC mis à jour pour prestataire ${prestataireId}`);
  }

  /**
   * Met à jour le montant à payer (amount_to_pay) pour un prestataire
   * Crée la colonne amount_to_pay si elle n'existe pas
   * Stocke aussi la devise (amount_currency) si fournie
   */
  async updateAmountInTable(
    formId: string,
    prestataireId: string,
    amount: number,
    currency?: string,
  ): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Récupérer la dernière validation ou l'enregistrement original
    const baseRecord = await this.getLastValidationOrOriginal(formId, prestataireId);
    
    if (!baseRecord) {
      throw new Error(`Aucun enregistrement trouvé pour le prestataire ${prestataireId}`);
    }

    // Récupérer les colonnes existantes
    const existingColumns = await this.dataSource.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       AND table_schema = 'public'`,
      [tableName],
    );

    const existingColumnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase()),
    );

    // Créer la colonne amount_to_pay si elle n'existe pas
    if (!existingColumnNames.has('amount_to_pay')) {
      try {
        await this.dataSource.query(
          `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS amount_to_pay NUMERIC DEFAULT 0`,
        );
        console.log(` Colonne amount_to_pay ajoutée à ${tableName}`);
        existingColumnNames.add('amount_to_pay');
      } catch (error: any) {
        console.error(` Erreur lors de l'ajout de la colonne amount_to_pay:`, error.message);
        throw new Error(`Impossible de créer la colonne amount_to_pay: ${error.message}`);
      }
    }

    // Créer la colonne amount_currency si elle n'existe pas et qu'une devise est fournie
    if (currency && !existingColumnNames.has('amount_currency')) {
      try {
        await this.dataSource.query(
          `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS amount_currency VARCHAR(10) DEFAULT 'USD'`,
        );
        console.log(` Colonne amount_currency ajoutée à ${tableName}`);
        existingColumnNames.add('amount_currency');
      } catch (error: any) {
        console.error(` Erreur lors de l'ajout de la colonne amount_currency:`, error.message);
        throw new Error(`Impossible de créer la colonne amount_currency: ${error.message}`);
      }
    }

    // Préparer les mises à jour
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Mettre à jour UNIQUEMENT amount_to_pay (pas payment_amount)
    updates.push(`amount_to_pay = $${paramIndex}`);
    values.push(amount);
    paramIndex++;

    // Mettre à jour amount_currency si fournie
    if (currency && existingColumnNames.has('amount_currency')) {
      updates.push(`amount_currency = $${paramIndex}`);
      values.push(currency);
      paramIndex++;
    }

    // Toujours mettre à jour updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Exécuter la mise à jour
    const whereClause = `WHERE id = $${paramIndex} OR prestataire_id = $${paramIndex}`;
    values.push(baseRecord.id || baseRecord.prestataire_id || prestataireId);
    paramIndex++;

    const updateQuery = `
      UPDATE "${tableName}"
      SET ${updates.join(', ')}
      ${whereClause}
    `;

    await this.dataSource.query(updateQuery, values);
  }

  /**
   * Supprime un enregistrement (prestataire) de la table du formulaire
   */
  async deleteSubmission(formId: string, prestataireId: string): Promise<void> {
    const tableName = this.getTableName(formId);

    if (!(await this.tableExists(tableName))) {
      throw new Error(`La table ${tableName} n'existe pas. Le formulaire doit être publié d'abord.`);
    }

    // Supprimer l'enregistrement par son ID
    const result = await this.dataSource.query(
      `DELETE FROM "${tableName}" WHERE id = $1`,
      [prestataireId],
    );

    if (result.rowCount === 0) {
      throw new Error(`Prestataire avec l'ID ${prestataireId} non trouvé dans la table ${tableName}`);
    }

    console.log(`🗑️ Prestataire supprimé: ${prestataireId} de la table ${tableName}`);
  }

  /**
   * Supprime la table d'un formulaire (lors de la suppression du formulaire)
   */
  async dropFormTable(formId: string): Promise<void> {
    const tableName = this.getTableName(formId);

    if (await this.tableExists(tableName)) {
      await this.dataSource.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      console.log(`🗑️ Table supprimée: ${tableName}`);
    }
  }
}

