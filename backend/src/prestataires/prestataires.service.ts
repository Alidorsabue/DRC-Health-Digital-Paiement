import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Prestataire } from './entities/prestataire.entity';
import { CreatePrestataireDto } from './dto/create-prestataire.dto';
import { PrestataireStatus } from '../common/enums/status.enum';
import { GeographicScope } from '../common/enums/geographic-scope.enum';
import { generatePrestataireId } from '../common/utils/id-generator.util';
import { DynamicTableService } from '../forms/dynamic-table.service';
import { CampaignsService } from '../campaigns/campaigns.service';

@Injectable()
export class PrestatairesService {
  constructor(
    @InjectRepository(Prestataire)
    public prestatairesRepository: Repository<Prestataire>,
    private dynamicTableService: DynamicTableService,
    private campaignsService: CampaignsService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async create(
    createPrestataireDto: CreatePrestataireDto,
    userId: string,
    userScope: GeographicScope,
    aireId?: string,
  ): Promise<Prestataire> {
    if (userScope === GeographicScope.AIRE && createPrestataireDto.aireId !== aireId) {
      throw new ForbiddenException('Vous ne pouvez enregistrer que dans votre aire');
    }

    // Générer un ID unique au format ID-YYMMDD-HHMM-XX
    const uniqueId = await generatePrestataireId(this.prestatairesRepository);

    const prestataire = this.prestatairesRepository.create({
      ...createPrestataireDto,
      id: uniqueId,
      enregistreParId: userId,
    });
    return this.prestatairesRepository.save(prestataire);
  }

  async findAll(filters: {
    campaignId?: string;
    provinceId?: string;
    zoneId?: string;
    aireId?: string;
    status?: PrestataireStatus;
  }): Promise<any[]> {
    // Récupérer depuis la table prestataires
    const query = this.prestatairesRepository.createQueryBuilder('prestataire')
      .leftJoinAndSelect('prestataire.campaign', 'campaign')
      .leftJoinAndSelect('prestataire.enregistrePar', 'enregistrePar')
      .leftJoinAndSelect('prestataire.validation', 'validation');

    if (filters.campaignId) {
      query.andWhere('prestataire.campaignId = :campaignId', { campaignId: filters.campaignId });
    }
    if (filters.provinceId) {
      query.andWhere('prestataire.provinceId = :provinceId', { provinceId: filters.provinceId });
    }
    if (filters.zoneId) {
      query.andWhere('prestataire.zoneId = :zoneId', { zoneId: filters.zoneId });
    }
    if (filters.aireId) {
      query.andWhere('prestataire.aireId = :aireId', { aireId: filters.aireId });
    }
    if (filters.status) {
      query.andWhere('prestataire.status = :status', { status: filters.status });
    }

    const prestatairesFromTable = await query.orderBy('prestataire.createdAt', 'DESC').getMany();
    console.log(`[PrestatairesService.findAll] Prestataires depuis table prestataires: ${prestatairesFromTable.length}`, filters);

    // Récupérer aussi depuis les tables form_*
    let formData: any[] = [];
    try {
      formData = await this.getAllFormTablesData(filters);
      console.log(`[PrestatairesService.findAll] Prestataires depuis tables form_*: ${formData.length}`, filters);
    } catch (error) {
      console.error('Erreur lors de la récupération des données depuis les tables form_*:', error);
    }

    // Combiner les deux sources de données
    const combinedData = [...prestatairesFromTable, ...formData];

    // Dédupliquer par ID (priorité aux données de la table prestataires)
    const uniqueMap = new Map<string, any>();
    
    // D'abord ajouter les données des tables form_*
    formData.forEach(item => {
      const id = item.id || item.prestataire_id || item.prestataireId;
      if (id && !uniqueMap.has(id)) {
        uniqueMap.set(id, this.transformFormDataToPrestataire(item));
      }
    });

    // Ensuite ajouter les données de la table prestataires (elles ont priorité)
    prestatairesFromTable.forEach(prestataire => {
      uniqueMap.set(prestataire.id, prestataire);
    });

    const result = Array.from(uniqueMap.values());
    console.log(`[PrestatairesService.findAll] Total prestataires après déduplication: ${result.length}`, filters);
    return result;
  }

  /**
   * Récupère les données de toutes les tables form_*
   */
  private async getAllFormTablesData(filters?: {
    campaignId?: string;
    provinceId?: string;
    zoneId?: string;
    aireId?: string;
    status?: string;
  }): Promise<any[]> {
    try {
      console.log('[getAllFormTablesData] Début avec filtres:', filters);
      // Récupérer toutes les tables qui commencent par 'form_'
      const formTables = await this.dataSource.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'form_%'
        ORDER BY tablename;
      `);

      console.log(`[getAllFormTablesData] ${formTables.length} tables form_* trouvées`);

      const allData: any[] = [];

      for (const table of formTables) {
        const tableName = table.tablename;
        try {
          const tableData = await this.getTableData(tableName, filters);
          console.log(`[getAllFormTablesData] Table ${tableName}: ${tableData.length} enregistrements trouvés`);
          allData.push(...tableData);
        } catch (error) {
          console.error(`Erreur lors de la récupération des données de ${tableName}:`, error);
        }
      }

      console.log(`[getAllFormTablesData] Total: ${allData.length} enregistrements de toutes les tables`);
      return allData;
    } catch (error) {
      console.error('Erreur lors de la récupération des tables form_*:', error);
      return [];
    }
  }

  /**
   * Récupère les données d'une table spécifique avec filtres
   */
  private async getTableData(
    tableName: string,
    filters?: {
      campaignId?: string;
      provinceId?: string;
      zoneId?: string;
      aireId?: string;
      status?: string;
    }
  ): Promise<any[]> {
    // Vérifier si la table existe
    const tableExists = await this.dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);

    if (!tableExists[0].exists) {
      return [];
    }

    // Récupérer les colonnes existantes de la table
    const existingColumns = await this.dataSource.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
    `, [tableName]);

    // Créer un Set des noms de colonnes en minuscules pour une recherche rapide
    const columnNames = new Set(
      existingColumns.map((col: any) => col.column_name.toLowerCase())
    );

    // Construire la requête avec les filtres
    let whereClause = '1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters?.campaignId) {
      const campaignColumns: string[] = [];
      const possibleCampaignNames = ['campaign_id', 'campaignid', 'campaignId'];
      for (const colName of possibleCampaignNames) {
        if (columnNames.has(colName)) {
          const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName)?.column_name;
          if (exactName) {
            campaignColumns.push(`"${exactName}"`);
          }
        }
      }
      if (campaignColumns.length > 0) {
        whereClause += ` AND (${campaignColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
        queryParams.push(filters.campaignId);
        paramIndex++;
      }
    }

    if (filters?.provinceId) {
      const provinceColumns: string[] = [];
      // Chercher les variantes possibles de noms de colonnes pour province
      const possibleProvinceNames = ['provinceid', 'admin1_h_c', 'province_id', 'admin1', 'provinceId'];
      for (const colName of possibleProvinceNames) {
        if (columnNames.has(colName)) {
          // Trouver le nom exact avec la casse correcte
          const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName)?.column_name;
          if (exactName) {
            provinceColumns.push(`"${exactName}"`);
          }
        }
      }
      if (provinceColumns.length > 0) {
        whereClause += ` AND (${provinceColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
        queryParams.push(filters.provinceId);
        paramIndex++;
      } else {
        // Si aucune colonne de province n'est trouvée, ne pas filtrer (pour éviter de perdre des données)
        console.warn(`[getTableData] Aucune colonne de province trouvée dans ${tableName}, filtrage par provinceId ignoré`);
      }
    }

    if (filters?.zoneId) {
      const zoneColumns: string[] = [];
      // Chercher les variantes possibles de noms de colonnes pour zone
      const possibleZoneNames = ['zoneid', 'admin3_h_c', 'zone_id', 'admin3', 'zoneId'];
      for (const colName of possibleZoneNames) {
        if (columnNames.has(colName)) {
          const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName)?.column_name;
          if (exactName) {
            zoneColumns.push(`"${exactName}"`);
          }
        }
      }
      if (zoneColumns.length > 0) {
        whereClause += ` AND (${zoneColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
        queryParams.push(filters.zoneId);
        paramIndex++;
      } else {
        console.warn(`[getTableData] Aucune colonne de zone trouvée dans ${tableName}, filtrage par zoneId ignoré`);
      }
    }

    if (filters?.aireId) {
      const aireColumns: string[] = [];
      // Chercher les variantes possibles de noms de colonnes pour aire
      const possibleAireNames = ['aireid', 'admin4_h_c', 'aire_id', 'admin4', 'aireId'];
      for (const colName of possibleAireNames) {
        if (columnNames.has(colName)) {
          const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName)?.column_name;
          if (exactName) {
            aireColumns.push(`"${exactName}"`);
          }
        }
      }
      if (aireColumns.length > 0) {
        whereClause += ` AND (${aireColumns.join(` = $${paramIndex} OR `)} = $${paramIndex})`;
        queryParams.push(filters.aireId);
        paramIndex++;
      } else {
        console.warn(`[getTableData] Aucune colonne d'aire trouvée dans ${tableName}, filtrage par aireId ignoré`);
      }
    }

    if (filters?.status) {
      const statusColumns: string[] = [];
      const possibleStatusNames = ['status', 'statut'];
      for (const colName of possibleStatusNames) {
        if (columnNames.has(colName)) {
          const exactName = existingColumns.find((col: any) => col.column_name.toLowerCase() === colName)?.column_name;
          if (exactName) {
            statusColumns.push(`"${exactName}"`);
          }
        }
      }
      if (statusColumns.length > 0) {
        whereClause += ` AND ${statusColumns[0]} = $${paramIndex}`;
        queryParams.push(filters.status);
        paramIndex++;
      }
    }

    // Pour la validation mobile, on veut seulement les enregistrements originaux (validation_sequence IS NULL)
    // pour éviter de récupérer les validations qui ont déjà été effectuées
    if (filters?.status === PrestataireStatus.ENREGISTRE) {
      whereClause += ` AND (validation_sequence IS NULL OR validation_sequence = 0)`;
      console.log(`[getTableData] Filtrage par validation_sequence IS NULL pour status ENREGISTRE`);
    }

    console.log(`[getTableData] tableName=${tableName}, whereClause=${whereClause}, params=`, queryParams);

    // Récupérer les enregistrements
    const query = `SELECT * FROM "${tableName}" WHERE ${whereClause} ORDER BY id, COALESCE(validation_sequence, -1) DESC`;
    const data = await this.dataSource.query(query, queryParams);

    console.log(`[getTableData] ${tableName}: ${data.length} enregistrements trouvés`);

    // Dédupliquer par ID, garder le plus récent (validation_sequence le plus élevé)
    // Si on a filtré par validation_sequence IS NULL, il n'y aura qu'un seul enregistrement par prestataire
    const uniqueMap = new Map<string, any>();
    data.forEach((record: any) => {
      const id = record.id || record.prestataire_id || record.prestataireId;
      if (id) {
        if (!uniqueMap.has(id)) {
          uniqueMap.set(id, record);
        } else {
          const existing = uniqueMap.get(id);
          const existingSeq = existing.validation_sequence || 0;
          const currentSeq = record.validation_sequence || 0;
          if (currentSeq > existingSeq) {
            uniqueMap.set(id, record);
          }
        }
      }
    });

    return Array.from(uniqueMap.values());
  }

  /**
   * Transforme les données d'une table form_* en format Prestataire
   */
  private transformFormDataToPrestataire(formData: any): any {
    return {
      id: formData.id || formData.prestataire_id || formData.prestataireId,
      nom: formData.nom || formData.family_name_i_c || formData.Nom || formData.nom_complet?.split(' ')[0],
      nom_complet: formData.nom_complet || 
        [formData.prenom || formData.given_name_i_c || formData.Prenom, 
         formData.nom || formData.family_name_i_c || formData.Nom,
         formData.postnom || formData.middle_name_i_c || formData.Postnom]
        .filter(Boolean).join(' '),
      zoneId: formData.zone_id || formData.zoneId,
      aireId: formData.aire_id || formData.aireId,
      provinceId: formData.province_id || formData.provinceId,
      status: formData.status || 'ENREGISTRE',
      campaignId: formData.campaign_id || formData.campaignId,
      paymentStatus: formData.payment_status || formData.paymentStatus || 'PENDING',
      ...formData,
    };
  }

  async findOne(id: string): Promise<Prestataire> {
    const prestataire = await this.prestatairesRepository.findOne({
      where: { id },
      relations: ['campaign', 'enregistrePar', 'validation'],
    });
    if (!prestataire) {
      throw new NotFoundException(`Prestataire avec l'ID ${id} non trouvé`);
    }
    return prestataire;
  }

  async findByCampaignAndAire(
    campaignId: string,
    aireId: string,
  ): Promise<Prestataire[]> {
    return this.prestatairesRepository.find({
      where: { campaignId, aireId },
      relations: ['campaign', 'validation'],
    });
  }

  /**
   * Créer un prestataire depuis une soumission publique (sans userId)
   * Utilise un userId système ou null selon votre logique métier
   */
  async createPublic(
    createPrestataireDto: CreatePrestataireDto,
  ): Promise<Prestataire> {
    // Pour les soumissions publiques, on peut utiliser un userId système
    // ou modifier l'entité pour rendre enregistreParId nullable
    // Pour l'instant, on utilise un UUID système par défaut
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

    // Générer un ID unique au format ID-YYMMDD-HHMM-XX
    const uniqueId = await generatePrestataireId(this.prestatairesRepository);

    const prestataire = this.prestatairesRepository.create({
      ...createPrestataireDto,
      id: uniqueId,
      enregistreParId: SYSTEM_USER_ID, // Ou null si vous modifiez l'entité
    });
    return this.prestatairesRepository.save(prestataire);
  }

  /**
   * Récupérer les prestataires à valider (status ENREGISTRE et VALIDE_PAR_IT)
   */
  /**
   * Récupère les prestataires en attente de validation depuis la table du formulaire
   * @param formId - ID du formulaire d'enregistrement (optionnel, si non fourni, cherche dans toutes les campagnes)
   * @param user - Utilisateur actuel (pour filtrer par aire de santé si IT avec scope AIRE)
   * @param campaignId - ID de la campagne (optionnel, pour filtrer par campagne)
   */
  async findPendingValidation(formId?: string, user?: any, campaignId?: string): Promise<any[]> {
    try {
      let targetFormId = formId;

      // Si formId n'est pas fourni, chercher le premier formulaire d'enregistrement disponible
      if (!targetFormId) {
        const allCampaigns = await this.campaignsService.findAll();
        for (const campaign of allCampaigns) {
          if (campaign.enregistrementFormId) {
            targetFormId = campaign.enregistrementFormId;
            break;
          }
        }
      }

      if (!targetFormId) {
        // Fallback: retourner depuis la table prestataires si aucun formulaire trouvé
        const whereConditions: any[] = [
          { status: PrestataireStatus.ENREGISTRE },
          { status: PrestataireStatus.VALIDE_PAR_IT },
        ];
        
        // Filtrer par zoneId pour les utilisateurs MCZ
        if (user && user.role === 'MCZ' && user.zoneId) {
          whereConditions.forEach(condition => {
            condition.zoneId = user.zoneId;
          });
        }
        // Filtrer par aire de santé pour les utilisateurs IT avec scope AIRE
        else if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
          whereConditions.forEach(condition => {
            condition.aireId = user.aireId;
          });
        }
        // Filtrer par zoneId pour les utilisateurs IT avec scope ZONE
        else if (user && user.role === 'IT' && user.scope === 'ZONE' && user.zoneId) {
          whereConditions.forEach(condition => {
            condition.zoneId = user.zoneId;
          });
        }
        // Filtrer par provinceId pour les utilisateurs IT avec scope PROVINCE
        else if (user && user.role === 'IT' && user.scope === 'PROVINCE' && user.provinceId) {
          whereConditions.forEach(condition => {
            condition.provinceId = user.provinceId;
          });
        }
        
        const prestataires = await this.prestatairesRepository.find({
          where: whereConditions,
          relations: ['campaign'],
          order: { createdAt: 'DESC' },
        });
        return prestataires.map(p => ({
          id: p.id,
          ...(p.enregistrementData || {}),
          status: p.status,
          campaignId: p.campaignId,
        }));
      }

      // Récupérer depuis la table du formulaire
      // Les prestataires en attente sont ceux avec status ENREGISTRE ou VALIDE_PAR_IT
      // Ne pas filtrer par validationSequence pour voir tous les enregistrements (originaux et validations)
      const filters: any = {};
      
      // Filtrer par campagne si fournie
      if (campaignId) {
        filters.campaignId = campaignId;
      }
      
      // Filtrer par zoneId pour les utilisateurs MCZ
      if (user && user.role === 'MCZ' && user.zoneId) {
        filters.zoneId = user.zoneId;
      }
      // Filtrer par aire de santé pour les utilisateurs IT avec scope AIRE
      else if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
        filters.aireId = user.aireId;
      }
      // Filtrer par zoneId pour les utilisateurs IT avec scope ZONE
      else if (user && user.role === 'IT' && user.scope === 'ZONE' && user.zoneId) {
        filters.zoneId = user.zoneId;
      }
      // Filtrer par provinceId pour les utilisateurs IT avec scope PROVINCE
      else if (user && user.role === 'IT' && user.scope === 'PROVINCE' && user.provinceId) {
        filters.provinceId = user.provinceId;
      }
      // IT sans scope ou SUPERADMIN: pas de filtre géographique (voir tous)
      
      const { data } = await this.dynamicTableService.getSubmissions(
        targetFormId,
        1,
        10000, // Récupérer tous les enregistrements
        filters,
      );

      // Filtrer par statut et transformer les données
      return data
        .filter((record: any) => {
          const status = record.status || 'ENREGISTRE';
          return status === 'ENREGISTRE' || status === 'VALIDE_PAR_IT';
        })
        .map((record: any) => {
          // Extraire les données du formulaire depuis raw_data ou directement depuis les colonnes
          const formData = record.raw_data || {};
          // Ajouter aussi les colonnes directes si elles existent
          Object.keys(record).forEach(key => {
            if (!['id', 'submission_id', 'form_id', 'form_version', 'campaign_id', 
                  'prestataire_id', 'status', 'presence_days', 'validation_date',
                  'kyc_status', 'approval_status', 'approval_date', 'payment_status',
                  'payment_amount', 'payment_date', 'paid_at', 'parent_submission_id',
                  'validation_sequence', 'created_at', 'updated_at', 'raw_data'].includes(key.toLowerCase())) {
              formData[key] = record[key];
            }
          });
          
          // Utiliser record.id (ID de la soumission) comme ID de prestataire
          // record.id est maintenant au format ID-YYMM-HHmm-XXX et sert d'identifiant unique
          const prestataireId = record.id;
          
          return {
            id: prestataireId, // Utiliser l'ID de la soumission comme ID de prestataire
            prestataireId: record.prestataire_id || prestataireId, // Garder prestataire_id si disponible
            submissionId: record.submission_id || prestataireId,
            status: record.status || 'ENREGISTRE',
            campaignId: record.campaign_id,
            presenceDays: record.presence_days,
            presence_days: record.presence_days, // snake_case pour compatibilité
            validationDate: record.validation_date, // camelCase pour faciliter l'accès depuis le mobile
            validation_date: record.validation_date, // snake_case pour compatibilité
            kycStatus: record.kyc_status,
            approvalStatus: record.approval_status,
            paymentStatus: record.payment_status,
            ...formData, // Toutes les données du formulaire
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        })
        .sort((a: any, b: any) => {
          // Trier par date de création décroissante
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
    } catch (error) {
      console.error(`Erreur lors de la récupération des prestataires depuis la table du formulaire:`, error);
      // Fallback: retourner depuis la table prestataires
      const whereConditions: any[] = [
        { status: PrestataireStatus.ENREGISTRE },
        { status: PrestataireStatus.VALIDE_PAR_IT },
      ];
      
      // Filtrer par zoneId pour les utilisateurs MCZ
      if (user && user.role === 'MCZ' && user.zoneId) {
        whereConditions.forEach(condition => {
          condition.zoneId = user.zoneId;
        });
      }
      // Filtrer par aire de santé pour les utilisateurs IT avec scope AIRE
      else if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
        whereConditions.forEach(condition => {
          condition.aireId = user.aireId;
        });
      }
      // Filtrer par zoneId pour les utilisateurs IT avec scope ZONE
      else if (user && user.role === 'IT' && user.scope === 'ZONE' && user.zoneId) {
        whereConditions.forEach(condition => {
          condition.zoneId = user.zoneId;
        });
      }
      // Filtrer par provinceId pour les utilisateurs IT avec scope PROVINCE
      else if (user && user.role === 'IT' && user.scope === 'PROVINCE' && user.provinceId) {
        whereConditions.forEach(condition => {
          condition.provinceId = user.provinceId;
        });
      }
      
      const prestataires = await this.prestatairesRepository.find({
        where: whereConditions,
        relations: ['campaign'],
        order: { createdAt: 'DESC' },
      });
      return prestataires.map(p => ({
        id: p.id,
        ...(p.enregistrementData || {}),
        status: p.status,
        campaignId: p.campaignId,
      }));
    }
  }

  /**
   * Valider un prestataire (mettre à jour presenceDays et status)
   * Crée une nouvelle ligne si c'est pour une autre campagne, sinon met à jour l'existante
   */
  async validatePrestataire(
    id: string,
    presenceDays: number,
    validationDate?: string,
    campaignId?: string,
    formId?: string,
  ): Promise<any> {
    // Récupérer le formId depuis la campagne si non fourni
    let targetFormId = formId;
    if (!targetFormId && campaignId) {
      const campaign = await this.campaignsService.findOne(campaignId);
      if (campaign && campaign.enregistrementFormId) {
        targetFormId = campaign.enregistrementFormId;
      }
    }

    if (!targetFormId) {
      throw new NotFoundException('formId requis pour valider un prestataire. Fournissez-le directement ou via campaignId.');
    }

    if (!validationDate) {
      validationDate = new Date().toISOString();
    }

    if (!campaignId) {
      throw new BadRequestException('campaignId est requis pour valider un prestataire');
    }
    
    console.log(`[validatePrestataire] Validation pour prestataire ${id}, campagne ${campaignId}`);
    
    // ÉTAPE 1: Vérifier si une validation existe déjà pour ce prestataire et cette campagne
    const existingValidation = await this.dynamicTableService.findValidationByCampaign(
      targetFormId,
      id,
      campaignId,
    );

    if (existingValidation) {
      console.log(`[validatePrestataire] Validation existante trouvée pour campagne ${campaignId}, mise à jour...`);
      // Mettre à jour la validation existante pour cette campagne
      await this.dynamicTableService.updateValidationInTable(
        targetFormId,
        id,
        presenceDays,
        validationDate,
        campaignId,
      );

      // Récupérer l'enregistrement mis à jour pour le retourner
      const { data } = await this.dynamicTableService.getSubmissions(
        targetFormId,
        1,
        1,
        { prestataireId: id, campaignId },
      );

      if (!data || data.length === 0) {
        throw new NotFoundException(`Validation non trouvée après mise à jour`);
      }

      return data[0];
    }

    // ÉTAPE 2: Vérifier s'il existe un enregistrement original (validation_sequence IS NULL) pour cette campagne
    const originalRecord = await this.dynamicTableService.getOriginalSubmissionByCampaign(
      targetFormId,
      id,
      campaignId,
    );

    if (originalRecord) {
      console.log(`[validatePrestataire] Enregistrement original trouvé pour campagne ${campaignId}, première validation - mise à jour de l'original...`);
      // PREMIÈRE VALIDATION: Mettre à jour l'enregistrement original
      await this.dynamicTableService.updateValidationInTable(
        targetFormId,
        id,
        presenceDays,
        validationDate,
        campaignId,
      );

      // Récupérer l'enregistrement mis à jour
      const { data } = await this.dynamicTableService.getSubmissions(
        targetFormId,
        1,
        1,
        { prestataireId: id, campaignId },
      );

      if (!data || data.length === 0) {
        throw new NotFoundException(`Enregistrement original non trouvé après mise à jour`);
      }

      return data[0];
    }

    // ÉTAPE 3: Aucun enregistrement pour cette campagne, créer une nouvelle ligne
    console.log(`[validatePrestataire] Aucun enregistrement trouvé pour campagne ${campaignId}, création d'une nouvelle ligne...`);
    try {
      await this.dynamicTableService.insertValidationRecord(
        targetFormId,
        id,
        campaignId,
        validationDate,
        presenceDays,
      );
    } catch (error: any) {
      // Si une validation existe déjà (erreur de duplication), essayer de la mettre à jour
      if (error.message && error.message.includes('existe déjà')) {
        console.log(`[validatePrestataire] Validation détectée après tentative de création, mise à jour...`);
        const existingValidationRetry = await this.dynamicTableService.findValidationByCampaign(
          targetFormId,
          id,
          campaignId,
        );
        
        if (existingValidationRetry) {
          await this.dynamicTableService.updateValidationInTable(
            targetFormId,
            id,
            presenceDays,
            validationDate,
            campaignId,
          );
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // Récupérer le nouvel enregistrement créé pour le retourner
    const { data } = await this.dynamicTableService.getSubmissions(
      targetFormId,
      1,
      1,
      { prestataireId: id, campaignId },
    );

    if (!data || data.length === 0) {
      throw new NotFoundException(`Nouvelle validation non trouvée après création`);
    }

    return data[0];
  }

  /**
   * Invalider un prestataire (remettre le status à ENREGISTRE)
   * Met à jour directement dans la table du formulaire
   */
  async invalidatePrestataire(
    id: string,
    formId?: string,
  ): Promise<any> {
    if (!formId) {
      // Essayer de trouver le formId depuis les données du prestataire
      // Mais comme on ne veut plus utiliser la table prestataires, on doit le passer en paramètre
      throw new NotFoundException('formId requis pour invalider un prestataire.');
    }

    // Mettre à jour directement dans la table du formulaire
    await this.dynamicTableService.updateInvalidationInTable(formId, id);

    // Récupérer l'enregistrement mis à jour pour le retourner
    const tableName = this.dynamicTableService.getTableName(formId);
    const updatedRecord = await this.dynamicTableService['dataSource'].query(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      [id],
    );

    if (!updatedRecord || updatedRecord.length === 0) {
      throw new NotFoundException(`Prestataire avec l'ID ${id} non trouvé dans la table ${tableName}`);
    }
    
    return updatedRecord[0];
  }

  /**
   * Mettre à jour les informations d'un prestataire
   * Met à jour directement dans la table du formulaire
   */
  async updatePrestataire(
    id: string,
    updateDto: Partial<{
      nom: string;
      prenom: string;
      postnom: string;
      telephone: string;
      categorie: string;
    }>,
    formId?: string,
  ): Promise<any> {
    if (!formId) {
      throw new NotFoundException('formId requis pour mettre à jour un prestataire.');
    }

    // Mettre à jour directement dans la table du formulaire
    await this.dynamicTableService.updatePrestataireInTable(formId, id, updateDto);

    // Si le téléphone a changé, mettre à jour le KYC (la méthode updateKycInTable gère déjà cela)
    if (updateDto.telephone !== undefined) {
      try {
        // Récupérer le statut KYC existant depuis la table du formulaire
        const { data } = await this.dynamicTableService.getSubmissions(
          formId,
          1,
          1,
          { prestataireId: id },
        );

        if (data && data.length > 0) {
          const currentRecord = data[0];
          const existingKycStatus = currentRecord.kyc_status || 
            (currentRecord.raw_data && currentRecord.raw_data.kycStatus);
          
          if (existingKycStatus) {
            await this.dynamicTableService.updateKycInTable(
              formId,
              id,
              existingKycStatus,
              updateDto.telephone,
            );
          }
        }
      } catch (error) {
        console.error(`Erreur lors de la mise à jour du KYC:`, error);
      }
    }

    // Récupérer l'enregistrement mis à jour pour le retourner
    const tableName = this.dynamicTableService.getTableName(formId);
    const updatedRecord = await this.dynamicTableService['dataSource'].query(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      [id],
    );

    if (!updatedRecord || updatedRecord.length === 0) {
      throw new NotFoundException(`Prestataire avec l'ID ${id} non trouvé dans la table ${tableName}`);
    }

    return updatedRecord[0];
  }

  /**
   * Supprimer un prestataire
   * Supprime directement dans la table du formulaire
   */
  async deletePrestataire(
    id: string,
    formId?: string,
  ): Promise<void> {
    if (!formId) {
      throw new NotFoundException('formId requis pour supprimer un prestataire.');
    }

    // Supprimer directement dans la table du formulaire
    await this.dynamicTableService.deleteSubmission(formId, id);
  }

  /**
   * Met à jour le statut KYC d'un prestataire
   * Met à jour directement dans la table du formulaire
   */
  async updateKycStatus(
    id: string,
    kycStatus: string,
    formId?: string,
    telephone?: string,
  ): Promise<any> {
    if (!formId) {
      throw new NotFoundException('formId requis pour mettre à jour le statut KYC.');
    }

    // Mettre à jour directement dans la table du formulaire
        await this.dynamicTableService.updateKycInTable(
          formId,
          id,
          kycStatus,
      telephone,
        );

    // Récupérer l'enregistrement mis à jour pour le retourner
    const tableName = this.dynamicTableService.getTableName(formId);
    const updatedRecord = await this.dynamicTableService['dataSource'].query(
      `SELECT * FROM "${tableName}" WHERE id = $1`,
      [id],
    );

    if (!updatedRecord || updatedRecord.length === 0) {
      throw new NotFoundException(`Prestataire avec l'ID ${id} non trouvé dans la table ${tableName}`);
    }

    return updatedRecord[0];
  }

  /**
   * Récupère toutes les validations d'un prestataire depuis la table dynamique
   * Cherche dans toutes les campagnes qui utilisent le même formulaire d'enregistrement
   */
  async getPrestataireValidations(prestataireId: string): Promise<any[]> {
    const prestataire = await this.findOne(prestataireId);
    
    try {
      let formId: string | null = null;

      // Si le prestataire a une campagne, récupérer le formId depuis cette campagne
      if (prestataire.campaignId) {
        const campaign = await this.campaignsService.findOne(prestataire.campaignId);
        if (campaign && campaign.enregistrementFormId) {
          formId = campaign.enregistrementFormId;
        }
      }

      // Si on n'a pas de formId, chercher dans toutes les campagnes pour trouver le formulaire utilisé
      if (!formId) {
        const allCampaigns = await this.campaignsService.findAll();
        // Prendre le premier formulaire d'enregistrement trouvé (normalement tous les prestataires d'un même type utilisent le même formulaire)
        for (const campaign of allCampaigns) {
          if (campaign.enregistrementFormId) {
            formId = campaign.enregistrementFormId;
            break;
          }
        }
      }

      if (!formId) {
        return [];
      }

      // Récupérer toutes les validations depuis la table dynamique
      return await this.dynamicTableService.getPrestataireValidations(
        formId,
        prestataireId,
      );
    } catch (error) {
      console.error(`Erreur lors de la récupération des validations:`, error);
      return [];
    }
  }
}

