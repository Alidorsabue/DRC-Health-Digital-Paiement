import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { PaymentsService } from '../payments/payments.service';
import { FormsService } from '../forms/forms.service';
import { Payment } from '../payments/entities/payment.entity';
import { PrestataireStatus } from '../common/enums/status.enum';
import { PaymentStatus } from '../common/enums/status.enum';

@Injectable()
export class StatsService {
  constructor(
    private prestatairesService: PrestatairesService,
    private paymentsService: PaymentsService,
    private formsService: FormsService,
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async getNationalStats(filters?: { campaignId?: string; formId?: string }) {
    console.log(`=== DEBUG STATS getNationalStats ===`);
    console.log(`Filtres:`, filters);
    
    try {
      // Récupérer les données de toutes les tables form_*
      const allFormData = await this.getAllFormTablesData(filters);
      
      console.log(`DEBUG STATS: ${allFormData.length} enregistrements trouvés dans les tables form_*`);
      
      let combinedData: any[] = [];
      
      // PRIORITÉ: Utiliser les données des tables form_* si disponibles
      if (allFormData.length > 0) {
        console.log(`DEBUG STATS: Utilisation des données des tables form_* (${allFormData.length} enregistrements)`);
        combinedData = allFormData;
      } else {
        // Si aucune donnée dans les tables form_*, utiliser uniquement la dernière table créée
        console.log('DEBUG STATS: Aucune donnée dans les tables form_*. Utilisation de la dernière table créée uniquement.');
        const lastTableData = await this.getLastFormTableData(filters);
        if (lastTableData.length > 0) {
          console.log(`DEBUG STATS: ${lastTableData.length} enregistrements trouvés dans la dernière table créée`);
          combinedData = lastTableData;
        } else {
          // Fallback: utiliser uniquement la table prestataires si même la dernière table est vide
          console.log('DEBUG STATS: Aucune donnée dans la dernière table. Utilisation de la table prestataires uniquement.');
          const allPrestataires = await this.prestatairesService.findAll(
            filters?.campaignId ? { campaignId: filters.campaignId } : {}
          );
          console.log(`DEBUG STATS: ${allPrestataires.length} enregistrements trouvés dans la table prestataires`);
          combinedData = allPrestataires;
        }
      }
      
      // Dédupliquer les prestataires avant de calculer les statistiques
      const deduplicatedData = this.deduplicatePrestataires(combinedData);
      
      // Compter les prestataires payés depuis les données dédupliquées
      const paidCount = this.countPaidFromData(deduplicatedData);

      console.log(`DEBUG STATS: ${combinedData.length} enregistrements avant déduplication, ${deduplicatedData.length} prestataires uniques après déduplication`);
      console.log(`DEBUG STATS: Prestataires payés = ${paidCount}`);
      
      const byStatus = this.groupByStatus(deduplicatedData);
      console.log(`DEBUG STATS: Répartition par statut:`, byStatus);

      return {
        total: deduplicatedData.length,
        byStatus: byStatus || {},
        byProvince: this.groupByProvince(deduplicatedData) || {},
        byCategory: this.groupByCategory(deduplicatedData) || {},
        paid: paidCount || 0,
      };
    } catch (error) {
      console.error('Erreur dans getNationalStats:', error);
      // Retourner un objet vide plutôt que null pour éviter les erreurs frontend
      return {
        total: 0,
        byStatus: {},
        byProvince: {},
        byCategory: {},
        paid: 0,
      };
    }
  }

  /**
   * Récupère les données de toutes les tables form_* dans la base de données
   * Si la somme ne fonctionne pas ou s'il n'y a pas de données, utilise la dernière table créée
   */
  private async getAllFormTablesData(filters?: { campaignId?: string; formId?: string }): Promise<any[]> {
    try {
      console.log(`=== DEBUG getAllFormTablesData ===`);
      console.log(`Filtres:`, filters);
      
      // Récupérer toutes les tables qui commencent par 'form_'
      const formTables = await this.dataSource.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'form_%'
        ORDER BY tablename;
      `);

      console.log(`DEBUG getAllFormTablesData: ${formTables.length} tables form_* trouvées:`, formTables.map(t => t.tablename));

      const allData: any[] = [];

      // Si un formId est spécifié, ne traiter que la table correspondante
      if (filters?.formId) {
        console.log(`DEBUG STATS: Filtre formId appliqué: ${filters.formId}`);
        const expectedTableName = `form_${filters.formId.replace(/-/g, '_')}`;
        console.log(`DEBUG STATS: Recherche dans la table: ${expectedTableName}`);
        const tableData = await this.getTableData(expectedTableName, filters);
        console.log(`DEBUG STATS: ${tableData.length} enregistrements trouvés dans la table ${expectedTableName}`);
        return tableData;
      }

      // Essayer d'abord d'agréger toutes les tables
      console.log(`DEBUG STATS: Tentative d'agrégation de ${formTables.length} tables form_*`);
      for (const table of formTables) {
        const tableName = table.tablename;
        try {
          console.log(`DEBUG STATS: Traitement de la table ${tableName}...`);
          const tableData = await this.getTableData(tableName, filters);
          console.log(`DEBUG STATS: Table ${tableName}: ${tableData.length} enregistrements trouvés`);
          if (tableData.length > 0) {
            allData.push(...tableData);
            console.log(`DEBUG STATS: Ajout de ${tableData.length} enregistrements depuis ${tableName}. Total actuel: ${allData.length}`);
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération des données de ${tableName}:`, error);
          // Continuer avec les autres tables même si une échoue
        }
      }

      console.log(`DEBUG STATS: Total agrégé de toutes les tables: ${allData.length} enregistrements`);

      // Si aucune donnée n'a été trouvée, essayer la dernière table créée
      if (allData.length === 0) {
        console.log(`DEBUG STATS: Aucune donnée trouvée dans les tables form_*. Tentative avec la dernière table créée...`);
        try {
          const lastTableData = await this.getLastFormTableData(filters);
          console.log(`DEBUG STATS: Dernière table créée: ${lastTableData.length} enregistrements`);
          return lastTableData;
        } catch (fallbackError) {
          console.error('Erreur lors de la récupération de la dernière table:', fallbackError);
        }
      }

      return allData;
    } catch (error) {
      console.error('Erreur lors de la récupération des tables form_*:', error);
      // En cas d'erreur, essayer d'utiliser la dernière table créée
      try {
        console.log('Erreur lors de l\'agrégation. Utilisation de la dernière table créée...');
        const lastTableData = await this.getLastFormTableData(filters);
        console.log(`DEBUG STATS: Fallback dernière table: ${lastTableData.length} enregistrements`);
        return lastTableData;
      } catch (fallbackError) {
        console.error('Erreur lors de la récupération de la dernière table:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Récupère les données d'une table spécifique
   */
  private async getTableData(tableName: string, filters?: { campaignId?: string; formId?: string }): Promise<any[]> {
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

    // Construire la requête avec les filtres
    let whereClause = '1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters?.campaignId) {
      whereClause += ` AND campaign_id = $${paramIndex}`;
      queryParams.push(filters.campaignId);
      paramIndex++;
    }

    // IMPORTANT: Récupérer TOUS les prestataires
    // Stratégie: récupérer les enregistrements originaux (validation_sequence IS NULL)
    // ET les validations par IT (status = 'VALIDE_PAR_IT' ou validation_sequence > 0)
    // Pour chaque prestataire, on garde le plus récent (priorité à validation_sequence le plus élevé)
    
    // Récupérer TOUS les enregistrements sans filtre validation_sequence
    const query = `SELECT * FROM "${tableName}" WHERE ${whereClause} ORDER BY id, COALESCE(validation_sequence, -1) DESC`;
    const data = await this.dataSource.query(query, queryParams);
    
    console.log(`DEBUG STATS getTableData: ${data.length} enregistrements récupérés de ${tableName}`);
    
    if (data.length === 0) {
      console.warn(`DEBUG STATS getTableData: ⚠️ Aucune donnée trouvée dans ${tableName}`);
      return [];
    }
    
    // Dédupliquer: pour chaque prestataire (id), garder l'enregistrement le plus récent
    // Priorité: validation_sequence le plus élevé > original (NULL)
    // Si même validation_sequence, priorité au statut VALIDE_PAR_IT
    const prestatairesMap = new Map<string, any>();
    
    for (const row of data) {
      // Pour la déduplication, utiliser id comme clé principale
      // Les validations ont le même id que l'enregistrement original
      // mais ont validation_sequence > 0
      const prestataireId = row.id || row.prestataire_id || row.prestataireId;
      if (!prestataireId) {
        console.warn(`DEBUG STATS getTableData: Enregistrement sans ID ignoré`);
        continue;
      }
      
      const existing = prestatairesMap.get(prestataireId);
      const currentSeq = row.validation_sequence ?? 0; // NULL = 0 pour la comparaison
      const existingSeq = existing?.validation_sequence ?? 0;
      const currentStatus = (row.status || '').toUpperCase().trim();
      
      if (!existing) {
        // Premier enregistrement pour ce prestataire
        prestatairesMap.set(prestataireId, row);
      } else if (currentSeq > existingSeq) {
        // Le nouveau a un validation_sequence plus élevé, le garder (c'est une validation plus récente)
        prestatairesMap.set(prestataireId, row);
      } else if (currentSeq === existingSeq && currentSeq === 0) {
        // Les deux sont originaux (NULL), priorité au statut VALIDE_PAR_IT ou APPROUVE_PAR_MCZ
        const existingStatus = (existing.status || '').toUpperCase().trim();
        if ((currentStatus === 'VALIDE_PAR_IT' || currentStatus === 'APPROUVE_PAR_MCZ') && 
            existingStatus !== 'VALIDE_PAR_IT' && existingStatus !== 'APPROUVE_PAR_MCZ') {
          prestatairesMap.set(prestataireId, row);
        }
      } else if (currentSeq === existingSeq && currentSeq > 0) {
        // Les deux sont des validations avec le même validation_sequence
        // Priorité au statut VALIDE_PAR_IT ou APPROUVE_PAR_MCZ
        const existingStatus = (existing.status || '').toUpperCase().trim();
        if ((currentStatus === 'VALIDE_PAR_IT' || currentStatus === 'APPROUVE_PAR_MCZ') && 
            existingStatus !== 'VALIDE_PAR_IT' && existingStatus !== 'APPROUVE_PAR_MCZ') {
          prestatairesMap.set(prestataireId, row);
        }
      }
      // Si currentSeq < existingSeq, on garde l'existant (validation plus récente)
    }
    
    const deduplicatedData = Array.from(prestatairesMap.values());
    console.log(`DEBUG STATS getTableData: ${deduplicatedData.length} prestataires uniques après déduplication (sur ${data.length} enregistrements)`);
    
    // Log de la répartition par statut
    const statusCount = deduplicatedData.reduce((acc: any, p: any) => {
      const status = p.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log(`DEBUG STATS getTableData: Répartition par statut:`, statusCount);
    
    // Log des premiers prestataires pour vérification
    if (deduplicatedData.length > 0) {
      console.log(`DEBUG STATS getTableData: Exemple de prestataires (3 premiers):`, 
        deduplicatedData.slice(0, 3).map(p => ({
          id: p.id,
          status: p.status,
          validation_sequence: p.validation_sequence,
        }))
      );
    }
    
    // Transformer les données pour qu'elles aient la même structure que les prestataires
    // Support des colonnes provinceId, antenneId, zoneId, aireId (nomenclature standard)
    // Rétrocompatibilité avec admin1_h_c, admin2_h_c, admin3_h_c, admin4_h_c et province_id, zone_id, etc.
    const transformedData = deduplicatedData.map((row: any) => {
      // Extraire les données géographiques depuis les colonnes directes ou raw_data
      // Priorité : provinceId > province_id > admin1_h_c
      let provinceId = row.provinceId || row.province_id || row.admin1_h_c;
      let antenneId = row.antenneId || row.antenne_id || row.admin2_h_c;
      let zoneId = row.zoneId || row.zone_id || row.admin3_h_c;
      let aireId = row.aireId || row.aire_id || row.admin4_h_c;
      
      // Si les valeurs ne sont pas dans les colonnes directes, chercher dans raw_data
      if (!provinceId || !zoneId || !aireId) {
        const rawData = row.raw_data || row.enregistrementData || {};
        if (typeof rawData === 'string') {
          try {
            const parsed = JSON.parse(rawData);
            provinceId = provinceId || parsed.provinceId || parsed.province_id || parsed.admin1_h_c;
            antenneId = antenneId || parsed.antenneId || parsed.antenne_id || parsed.admin2_h_c;
            zoneId = zoneId || parsed.zoneId || parsed.zone_id || parsed.admin3_h_c;
            aireId = aireId || parsed.aireId || parsed.aire_id || parsed.admin4_h_c;
          } catch (e) {
            // Ignorer les erreurs de parsing
          }
        } else if (typeof rawData === 'object') {
          provinceId = provinceId || rawData.provinceId || rawData.province_id || rawData.admin1_h_c;
          antenneId = antenneId || rawData.antenneId || rawData.antenne_id || rawData.admin2_h_c;
          zoneId = zoneId || rawData.zoneId || rawData.zone_id || rawData.admin3_h_c;
          aireId = aireId || rawData.aireId || rawData.aire_id || rawData.admin4_h_c;
        }
      }
      
      return {
        id: row.id || row.submission_id,
        nom: row.nom || row.family_name_i_c || row.family_name || '',
        prenom: row.prenom || row.given_name_i_c || row.given_name || '',
        telephone: row.telephone || '',
        categorie: row.categorie || '',
        provinceId: provinceId || '',
        antenneId: antenneId || '',
        zoneId: zoneId || '',
        aireId: aireId || '',
        status: row.status || PrestataireStatus.ENREGISTRE,
        campaignId: row.campaign_id || row.campaignId,
        payment_status: row.payment_status || row.paymentStatus || '',
        paymentStatus: row.payment_status || row.paymentStatus || '',
        enregistrementData: row.raw_data || row.enregistrementData || {},
      };
    });

    return transformedData;
  }

  /**
   * Récupère les données de la dernière table créée (formulaire le plus récent)
   */
  private async getLastFormTableData(filters?: { campaignId?: string; formId?: string }): Promise<any[]> {
    try {
      // Récupérer tous les formulaires triés par date de création (plus récent en premier)
      const allForms = await this.formsService.findAll();
      
      if (allForms.length === 0) {
        console.log('Aucun formulaire trouvé');
        return [];
      }

      // Prendre le formulaire le plus récent
      const lastForm = allForms[0]; // Déjà trié par createdAt DESC dans findAll()
      const tableName = `form_${lastForm.id.replace(/-/g, '_')}`;
      
      console.log(`Utilisation de la dernière table créée: ${tableName} (formulaire: ${lastForm.name})`);
      
      return await this.getTableData(tableName, filters);
    } catch (error) {
      console.error('Erreur lors de la récupération de la dernière table créée:', error);
      return [];
    }
  }

  /**
   * Compte les prestataires payés depuis les données des tables de formulaires
   */
  private countPaidFromData(data: any[]): number {
    if (!data || data.length === 0) return 0;
    
    // Compter les prestataires avec payment_status = 'PAID' ou 'PAYE'
    const paidCount = data.filter((item: any) => {
      // Chercher payment_status dans plusieurs emplacements possibles
      const paymentStatus = item.payment_status || 
                           item.paymentStatus || 
                           item.enregistrementData?.payment_status ||
                           item.enregistrementData?.paymentStatus ||
                           '';
      const statusLower = String(paymentStatus).toLowerCase().trim();
      
      // Vérifier si le prestataire est payé
      const isPaid = statusLower === 'paid' || 
                     statusLower === 'paye' || 
                     statusLower === 'payé' ||
                     statusLower === 'PAID' ||
                     statusLower === 'PAYE';
      
      if (isPaid) {
        console.log(`DEBUG STATS countPaidFromData: Prestataire payé trouvé:`, {
          id: item.id,
          payment_status: paymentStatus,
        });
      }
      
      return isPaid;
    }).length;
    
    console.log(`DEBUG STATS countPaidFromData: ${paidCount} prestataires payés sur ${data.length} total`);
    return paidCount;
  }

  /**
   * @deprecated Utiliser countPaidFromData à la place
   * Compte les prestataires payés depuis la table payments (ancienne méthode)
   */
  private async getPaidCount(): Promise<number> {
    const count = await this.paymentsRepository.count({
      where: { status: PaymentStatus.PAID },
    });
    return count;
  }

  async getProvinceStats(provinceId: string, filters?: { campaignId?: string; formId?: string }) {
    try {
      console.log(`=== DEBUG STATS getProvinceStats ===`);
      console.log(`ProvinceId: ${provinceId}, Filtres:`, filters);
      
      // Récupérer les données de toutes les tables form_*
      const allFormData = await this.getAllFormTablesData(filters);
      const formDataForProvince = allFormData.filter(
        (item) => item.provinceId === provinceId
      );

      console.log(`DEBUG STATS PROVINCE: ${allFormData.length} enregistrements totaux, ${formDataForProvince.length} pour la province ${provinceId}`);

      let combinedData: any[] = [];
      
      // Si des données ont été trouvées dans les tables form_* pour cette province, les combiner avec prestataires
      if (allFormData.length > 0 && formDataForProvince.length > 0) {
        console.log(`DEBUG STATS PROVINCE: ${formDataForProvince.length} enregistrements trouvés dans les tables form_* pour la province ${provinceId}`);
        const prestataires = await this.prestatairesService.findAll({
          provinceId,
          ...(filters?.campaignId && { campaignId: filters.campaignId }),
        });
        combinedData = [...prestataires, ...formDataForProvince];
      } else if (allFormData.length === 0) {
        // Si aucune donnée dans les tables form_*, utiliser uniquement la dernière table créée
        console.log(`DEBUG STATS PROVINCE: Aucune donnée dans les tables form_*. Utilisation de la dernière table créée pour la province ${provinceId}`);
        const lastTableData = await this.getLastFormTableData(filters);
        combinedData = lastTableData.filter((item) => item.provinceId === provinceId);
        
        if (combinedData.length === 0) {
          // Fallback: utiliser uniquement la table prestataires
          console.log(`DEBUG STATS PROVINCE: Aucune donnée dans la dernière table. Utilisation de la table prestataires pour la province ${provinceId}`);
          combinedData = await this.prestatairesService.findAll({
            provinceId,
            ...(filters?.campaignId && { campaignId: filters.campaignId }),
          });
        }
      } else {
        // Si des données existent dans form_* mais pas pour cette province, utiliser uniquement la dernière table créée
        console.log(`DEBUG STATS PROVINCE: Données trouvées dans form_* mais pas pour la province ${provinceId}. Utilisation de la dernière table créée`);
        const lastTableData = await this.getLastFormTableData(filters);
        combinedData = lastTableData.filter((item) => item.provinceId === provinceId);
        
        if (combinedData.length === 0) {
          combinedData = await this.prestatairesService.findAll({
            provinceId,
            ...(filters?.campaignId && { campaignId: filters.campaignId }),
          });
        }
      }

      // Dédupliquer les prestataires avant de calculer les statistiques
      const deduplicatedData = this.deduplicatePrestataires(combinedData);
      
      console.log(`DEBUG STATS PROVINCE: ${combinedData.length} enregistrements avant déduplication, ${deduplicatedData.length} prestataires uniques après déduplication pour la province ${provinceId}`);
      const paidCount = this.countPaidFromData(deduplicatedData);

      return {
        total: deduplicatedData.length,
        byStatus: this.groupByStatus(deduplicatedData) || {},
        byZone: this.groupByZone(deduplicatedData) || {},
        byCategory: this.groupByCategory(deduplicatedData) || {},
        paid: paidCount || 0,
      };
    } catch (error) {
      console.error(`Erreur dans getProvinceStats pour ${provinceId}:`, error);
      return {
        total: 0,
        byStatus: {},
        byZone: {},
        byCategory: {},
        paid: 0,
      };
    }
  }

  async getZoneStats(zoneId: string, filters?: { campaignId?: string; formId?: string }) {
    try {
      console.log(`=== DEBUG STATS getZoneStats ===`);
      console.log(`ZoneId: ${zoneId}, Filtres:`, filters);
      
      // Récupérer les données de toutes les tables form_*
      const allFormData = await this.getAllFormTablesData(filters);
      const formDataForZone = allFormData.filter(
        (item) => item.zoneId === zoneId
      );

      console.log(`DEBUG STATS ZONE: ${allFormData.length} enregistrements totaux, ${formDataForZone.length} pour la zone ${zoneId}`);

      let combinedData: any[] = [];
      
      // Si des données ont été trouvées dans les tables form_* pour cette zone, les combiner avec prestataires
      if (allFormData.length > 0 && formDataForZone.length > 0) {
        console.log(`DEBUG STATS ZONE: ${formDataForZone.length} enregistrements trouvés dans les tables form_* pour la zone ${zoneId}`);
        const prestataires = await this.prestatairesService.findAll({
          zoneId,
          ...(filters?.campaignId && { campaignId: filters.campaignId }),
        });
        combinedData = [...prestataires, ...formDataForZone];
      } else if (allFormData.length === 0) {
        // Si aucune donnée dans les tables form_*, utiliser uniquement la dernière table créée
        console.log(`DEBUG STATS ZONE: Aucune donnée dans les tables form_*. Utilisation de la dernière table créée pour la zone ${zoneId}`);
        const lastTableData = await this.getLastFormTableData(filters);
        combinedData = lastTableData.filter((item) => item.zoneId === zoneId);
        
        if (combinedData.length === 0) {
          // Fallback: utiliser uniquement la table prestataires
          console.log(`DEBUG STATS ZONE: Aucune donnée dans la dernière table. Utilisation de la table prestataires pour la zone ${zoneId}`);
          combinedData = await this.prestatairesService.findAll({
            zoneId,
            ...(filters?.campaignId && { campaignId: filters.campaignId }),
          });
        }
      } else {
        // Si des données existent dans form_* mais pas pour cette zone, utiliser uniquement la dernière table créée
        console.log(`DEBUG STATS ZONE: Données trouvées dans form_* mais pas pour la zone ${zoneId}. Utilisation de la dernière table créée`);
        const lastTableData = await this.getLastFormTableData(filters);
        combinedData = lastTableData.filter((item) => item.zoneId === zoneId);
        
        if (combinedData.length === 0) {
          combinedData = await this.prestatairesService.findAll({
            zoneId,
            ...(filters?.campaignId && { campaignId: filters.campaignId }),
          });
        }
      }

      // Dédupliquer les prestataires avant de calculer les statistiques
      // Pour chaque prestataire (id), garder seulement l'enregistrement le plus récent
      const deduplicatedData = this.deduplicatePrestataires(combinedData);
      
      console.log(`DEBUG STATS ZONE: ${combinedData.length} enregistrements avant déduplication, ${deduplicatedData.length} prestataires uniques après déduplication pour la zone ${zoneId}`);
      const paidCount = this.countPaidFromData(deduplicatedData);

      return {
        total: deduplicatedData.length,
        byStatus: this.groupByStatus(deduplicatedData) || {},
        byAire: this.groupByAire(deduplicatedData) || {},
        byCategory: this.groupByCategory(deduplicatedData) || {},
        paid: paidCount || 0,
      };
    } catch (error) {
      console.error(`Erreur dans getZoneStats pour ${zoneId}:`, error);
      return {
        total: 0,
        byStatus: {},
        byAire: {},
        byCategory: {},
        paid: 0,
      };
    }
  }

  async getAireStats(aireId: string, filters?: { campaignId?: string; formId?: string }) {
    try {
      console.log(`=== DEBUG STATS getAireStats ===`);
      console.log(`AireId: ${aireId}, Filtres:`, filters);
      
      // Récupérer les données de toutes les tables form_*
      const allFormData = await this.getAllFormTablesData(filters);
      const formDataForAire = allFormData.filter(
        (item) => item.aireId === aireId
      );

      console.log(`DEBUG STATS AIRE: ${allFormData.length} enregistrements totaux, ${formDataForAire.length} pour l'aire ${aireId}`);

      let combinedData: any[] = [];
      
      // Si des données ont été trouvées dans les tables form_* pour cette aire, les combiner avec prestataires
      if (allFormData.length > 0 && formDataForAire.length > 0) {
        console.log(`DEBUG STATS AIRE: ${formDataForAire.length} enregistrements trouvés dans les tables form_* pour l'aire ${aireId}`);
        const prestataires = await this.prestatairesService.findAll({
          aireId,
          ...(filters?.campaignId && { campaignId: filters.campaignId }),
        });
        combinedData = [...prestataires, ...formDataForAire];
      } else if (allFormData.length === 0) {
        // Si aucune donnée dans les tables form_*, utiliser uniquement la dernière table créée
        console.log(`DEBUG STATS AIRE: Aucune donnée dans les tables form_*. Utilisation de la dernière table créée pour l'aire ${aireId}`);
        const lastTableData = await this.getLastFormTableData(filters);
        combinedData = lastTableData.filter((item) => item.aireId === aireId);
        
        if (combinedData.length === 0) {
          // Fallback: utiliser uniquement la table prestataires
          console.log(`DEBUG STATS AIRE: Aucune donnée dans la dernière table. Utilisation de la table prestataires pour l'aire ${aireId}`);
          combinedData = await this.prestatairesService.findAll({
            aireId,
            ...(filters?.campaignId && { campaignId: filters.campaignId }),
          });
        }
      } else {
        // Si des données existent dans form_* mais pas pour cette aire, utiliser uniquement la dernière table créée
        console.log(`DEBUG STATS AIRE: Données trouvées dans form_* mais pas pour l'aire ${aireId}. Utilisation de la dernière table créée`);
        const lastTableData = await this.getLastFormTableData(filters);
        combinedData = lastTableData.filter((item) => item.aireId === aireId);
        
        if (combinedData.length === 0) {
          combinedData = await this.prestatairesService.findAll({
            aireId,
            ...(filters?.campaignId && { campaignId: filters.campaignId }),
          });
        }
      }

      // Dédupliquer les prestataires avant de calculer les statistiques
      const deduplicatedData = this.deduplicatePrestataires(combinedData);
      
      console.log(`DEBUG STATS AIRE: ${combinedData.length} enregistrements avant déduplication, ${deduplicatedData.length} prestataires uniques après déduplication pour l'aire ${aireId}`);
      const paidCount = this.countPaidFromData(deduplicatedData);

      return {
        total: deduplicatedData.length,
        byStatus: this.groupByStatus(deduplicatedData) || {},
        byCategory: this.groupByCategory(deduplicatedData) || {},
        paid: paidCount || 0,
      };
    } catch (error) {
      console.error(`Erreur dans getAireStats pour ${aireId}:`, error);
      return {
        total: 0,
        byStatus: {},
        byCategory: {},
        paid: 0,
      };
    }
  }

  /**
   * Déduplique les prestataires en gardant seulement l'enregistrement le plus récent pour chaque prestataire unique
   * Pour chaque prestataire (id), garde soit l'enregistrement original (validation_sequence IS NULL)
   * soit la dernière validation (validation_sequence le plus élevé)
   */
  private deduplicatePrestataires(prestataires: any[]): any[] {
    const prestatairesMap = new Map<string, any>();
    
    for (const record of prestataires) {
      // Utiliser id comme clé principale pour la déduplication
      // Les validations ont le même id que l'enregistrement original (c'est l'ID du prestataire)
      // mais ont un validation_sequence > 0 et un statut VALIDE_PAR_IT
      const prestataireId = record.id || record.prestataire_id || record.prestataireId;
      if (!prestataireId) {
        console.warn(`[deduplicatePrestataires] Enregistrement sans ID ignoré:`, {
          id: record.id,
          prestataire_id: record.prestataire_id,
          prestataireId: record.prestataireId,
          submission_id: record.submission_id,
        });
        continue;
      }
      
      const existing = prestatairesMap.get(prestataireId);
      const currentSeq = record.validation_sequence ?? 0; // NULL = 0 pour la comparaison
      const existingSeq = existing?.validation_sequence ?? 0;
      
      if (!existing) {
        // Premier enregistrement pour ce prestataire
        prestatairesMap.set(prestataireId, record);
      } else if (currentSeq > existingSeq) {
        // Le nouveau a un validation_sequence plus élevé, le garder (c'est une validation plus récente)
        prestatairesMap.set(prestataireId, record);
      } else if (currentSeq === existingSeq && currentSeq === 0) {
        // Les deux sont originaux (NULL), priorité au statut VALIDE_PAR_IT ou APPROUVE_PAR_MCZ
        const currentStatus = (record.status || '').toUpperCase();
        const existingStatus = (existing.status || '').toUpperCase();
        if ((currentStatus === 'VALIDE_PAR_IT' || currentStatus === 'APPROUVE_PAR_MCZ') && 
            existingStatus !== 'VALIDE_PAR_IT' && existingStatus !== 'APPROUVE_PAR_MCZ') {
          prestatairesMap.set(prestataireId, record);
        }
      }
      // Si currentSeq < existingSeq, on garde l'existant (validation plus récente)
    }
    
    const result = Array.from(prestatairesMap.values());
    
    // Log de la répartition par statut après déduplication
    const statusCount = result.reduce((acc: any, p: any) => {
      const status = p.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    console.log(`[deduplicatePrestataires] ${prestataires.length} enregistrements → ${result.length} prestataires uniques`);
    console.log(`[deduplicatePrestataires] Répartition par statut:`, statusCount);
    
    // Log de quelques exemples pour déboguer
    if (result.length > 0) {
      console.log(`[deduplicatePrestataires] Exemples (3 premiers):`, 
        result.slice(0, 3).map(p => ({
          id: p.id,
          prestataire_id: p.prestataire_id,
          status: p.status,
          validation_sequence: p.validation_sequence,
        }))
      );
    }
    
    return result;
  }

  private groupByStatus(prestataires: any[]) {
    const groups: Record<string, number> = {};
    for (const p of prestataires) {
      // Récupérer le statut depuis plusieurs emplacements possibles
      let status = p.status || p.Status || PrestataireStatus.ENREGISTRE;
      
      // Normaliser le statut en majuscules
      if (typeof status === 'string') {
        status = status.toUpperCase().trim();
      }
      
      // Si le statut est vide ou null, utiliser ENREGISTRE par défaut
      if (!status || status === 'NULL' || status === '') {
        status = PrestataireStatus.ENREGISTRE;
      }
      
      groups[status] = (groups[status] || 0) + 1;
    }
    
    console.log(`[groupByStatus] Répartition finale:`, groups);
    return groups;
  }

  private groupByProvince(prestataires: any[]) {
    const groups: Record<string, number> = {};
    for (const p of prestataires) {
      groups[p.provinceId] = (groups[p.provinceId] || 0) + 1;
    }
    return groups;
  }

  private groupByZone(prestataires: any[]) {
    const groups: Record<string, number> = {};
    for (const p of prestataires) {
      groups[p.zoneId] = (groups[p.zoneId] || 0) + 1;
    }
    return groups;
  }

  private groupByAire(prestataires: any[]) {
    const groups: Record<string, number> = {};
    for (const p of prestataires) {
      groups[p.aireId] = (groups[p.aireId] || 0) + 1;
    }
    return groups;
  }

  private groupByCategory(prestataires: any[]) {
    const groups: Record<string, number> = {};
    for (const p of prestataires) {
      // Chercher la catégorie dans plusieurs emplacements possibles
      const categorie = p.categorie || 
                       p.role || 
                       p.campaign_role || 
                       p.campaign_role_i_f ||
                       p.enregistrementData?.categorie ||
                       p.enregistrementData?.role ||
                       p.enregistrementData?.campaign_role ||
                       p.enregistrementData?.campaign_role_i_f ||
                       'Non spécifié';
      groups[categorie] = (groups[categorie] || 0) + 1;
    }
    return groups;
  }

  /**
   * Récupère les provinces uniques depuis le dernier formulaire créé et en cours d'utilisation (sans prestataires)
   */
  async getProvincesFromData(): Promise<{ id: string; name: string }[]> {
    try {
      console.log('DEBUG STATS getProvincesFromData: Récupération depuis le dernier formulaire créé...');
      
      // Récupérer les données du dernier formulaire créé
      const lastTableData = await this.getLastFormTableData();
      const provinceIds = new Set<string>();
      
      // Récupérer uniquement depuis la dernière table créée (pas de prestataires)
      for (const item of lastTableData) {
        if (item.provinceId) {
          provinceIds.add(item.provinceId);
        }
      }
      
      const provinces = Array.from(provinceIds).map(id => ({ id, name: id }));
      console.log(`DEBUG STATS getProvincesFromData: ${provinces.length} provinces trouvées dans le dernier formulaire créé`);
      
      return provinces;
    } catch (error) {
      console.error('Erreur lors de la récupération des provinces depuis le dernier formulaire:', error);
      return [];
    }
  }

  /**
   * Récupère les zones uniques depuis le dernier formulaire créé et en cours d'utilisation pour une province donnée (sans prestataires)
   */
  async getZonesFromData(provinceId: string): Promise<{ id: string; name: string }[]> {
    try {
      console.log(`DEBUG STATS getZonesFromData: Récupération depuis le dernier formulaire créé pour la province ${provinceId}...`);
      
      // Récupérer les données du dernier formulaire créé
      const lastTableData = await this.getLastFormTableData();
      const zoneIds = new Set<string>();
      
      // Filtrer par provinceId et récupérer les zones
      const filteredData = lastTableData.filter(item => item.provinceId === provinceId);
      for (const item of filteredData) {
        if (item.zoneId) {
          zoneIds.add(item.zoneId);
        }
      }
      
      const zones = Array.from(zoneIds).map(id => ({ id, name: id }));
      console.log(`DEBUG STATS getZonesFromData: ${zones.length} zones trouvées dans le dernier formulaire créé pour la province ${provinceId}`);
      
      return zones;
    } catch (error) {
      console.error('Erreur lors de la récupération des zones depuis le dernier formulaire:', error);
      return [];
    }
  }

  /**
   * Récupère les aires uniques depuis le dernier formulaire créé et en cours d'utilisation pour une zone donnée (sans prestataires)
   */
  async getAiresFromData(zoneId: string): Promise<{ id: string; name: string }[]> {
    try {
      console.log(`DEBUG STATS getAiresFromData: Récupération depuis le dernier formulaire créé pour la zone ${zoneId}...`);
      
      // Récupérer les données du dernier formulaire créé
      const lastTableData = await this.getLastFormTableData();
      const aireIds = new Set<string>();
      
      // Filtrer par zoneId et récupérer les aires
      const filteredData = lastTableData.filter(item => item.zoneId === zoneId);
      for (const item of filteredData) {
        if (item.aireId) {
          aireIds.add(item.aireId);
        }
      }
      
      const aires = Array.from(aireIds).map(id => ({ id, name: id }));
      console.log(`DEBUG STATS getAiresFromData: ${aires.length} aires trouvées dans le dernier formulaire créé pour la zone ${zoneId}`);
      
      return aires;
    } catch (error) {
      console.error('Erreur lors de la récupération des aires depuis le dernier formulaire:', error);
      return [];
    }
  }
}

