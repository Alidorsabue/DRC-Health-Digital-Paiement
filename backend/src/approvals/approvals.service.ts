import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalMCZ, ApprovalDecision } from './entities/approval-mcz.entity';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { PrestataireStatus } from '../common/enums/status.enum';
import { DynamicTableService } from '../forms/dynamic-table.service';
import { CampaignsService } from '../campaigns/campaigns.service';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(ApprovalMCZ)
    private approvalsRepository: Repository<ApprovalMCZ>,
    private prestatairesService: PrestatairesService,
    private dynamicTableService: DynamicTableService,
    private campaignsService: CampaignsService,
  ) {}

  async create(
    prestataireId: string,
    createApprovalDto: CreateApprovalDto,
    userId: string,
    formId?: string,
  ): Promise<ApprovalMCZ> {
    // Récupérer le formId si non fourni
    let targetFormId = formId;
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
      throw new BadRequestException('formId requis pour approuver un prestataire.');
    }

    // Vérifier le statut directement dans la table du formulaire
    // Récupérer l'enregistrement depuis la table du formulaire
    const tableName = this.dynamicTableService.getTableName(targetFormId);
    const tableExists = await this.dynamicTableService.tableExists(tableName);
    
    if (!tableExists) {
      throw new NotFoundException(`La table du formulaire ${targetFormId} n'existe pas`);
    }

    // Utiliser getSubmissions pour récupérer l'enregistrement
    // Récupérer la dernière validation ou l'enregistrement original
    const { data } = await this.dynamicTableService.getSubmissions(
      targetFormId,
      1,
      10, // Récupérer plusieurs pour trouver la dernière validation
      { prestataireId },
    );

    if (!data || data.length === 0) {
      throw new NotFoundException(`Prestataire avec l'ID ${prestataireId} non trouvé dans la table du formulaire`);
    }

    // Trouver la dernière validation (avec validation_sequence le plus élevé) ou l'enregistrement original
    const prestataireRecord = data.find((r: any) => 
      r.validation_sequence != null && r.status === 'VALIDE_PAR_IT'
    ) || data.find((r: any) => r.validation_sequence == null);

    if (!prestataireRecord) {
      throw new NotFoundException(`Prestataire avec l'ID ${prestataireId} non trouvé dans la table du formulaire`);
    }

    const currentStatus = prestataireRecord.status;
    if (currentStatus !== 'VALIDE_PAR_IT') {
      throw new BadRequestException(
        'Le prestataire doit être validé par IT avant approbation',
      );
    }

    // Récupérer le campaignId depuis l'enregistrement
    const campaignId = prestataireRecord.campaign_id || prestataireRecord.campaignId;

    const approval = this.approvalsRepository.create({
      prestataireId,
      decision: createApprovalDto.decision,
      commentaire: createApprovalDto.commentaire,
      mczId: userId,
    });

    const savedApproval = await this.approvalsRepository.save(approval);

    // Mettre à jour directement dans la table du formulaire
    try {
      await this.dynamicTableService.updateApprovalInTable(
        targetFormId,
        prestataireId,
        createApprovalDto.decision,
        new Date().toISOString(),
        createApprovalDto.commentaire,
        campaignId, // Passer le campaignId pour trouver la bonne validation
      );
    } catch (error) {
      // Log l'erreur mais ne pas faire échouer l'approbation
      console.error(`Erreur lors de la mise à jour de l'approbation dans la table du formulaire:`, error);
    }

    return savedApproval;
  }

  async approveBatch(
    prestataireIds: string[],
    userId: string,
    commentaire?: string,
  ): Promise<ApprovalMCZ[]> {
    const approvals: ApprovalMCZ[] = [];
    for (const prestataireId of prestataireIds) {
      const approval = await this.create(
        prestataireId,
        { decision: ApprovalDecision.APPROVED, commentaire },
        userId,
      );
      approvals.push(approval);
    }
    return approvals;
  }

  async rejectBatch(
    prestataireIds: string[],
    userId: string,
    commentaire?: string,
  ): Promise<ApprovalMCZ[]> {
    const approvals: ApprovalMCZ[] = [];
    for (const prestataireId of prestataireIds) {
      const approval = await this.create(
        prestataireId,
        { decision: ApprovalDecision.REJECTED, commentaire },
        userId,
      );
      approvals.push(approval);
    }
    return approvals;
  }

  /**
   * Récupère les approbations depuis la table du formulaire au lieu de la table prestataires
   * @param formId - ID du formulaire d'enregistrement
   * @param zoneId - ID de la zone (optionnel, pour MCZ)
   * @param aireId - ID de l'aire (optionnel, pour IT)
   * @param status - Statut d'approbation (optionnel)
   */
  async findByZoneOrAire(formId: string, zoneId?: string, aireId?: string, status?: PrestataireStatus): Promise<any[]> {
    try {
      // Récupérer depuis la table du formulaire
      // IMPORTANT: Ne PAS filtrer par validationSequence pour inclure TOUS les prestataires
      // (originaux ET validés par IT qui ont validation_sequence > 0)
      // Le filtrage par status se fera côté frontend si nécessaire
      const filters: any = {
        // Ne pas filtrer par validationSequence pour inclure les prestataires validés par IT
        // validationSequence: null, // ❌ Ce filtre excluait les prestataires validés par IT
      };
      
      // Filtrer par zoneId si fourni (pour MCZ)
      if (zoneId) {
        filters.zoneId = zoneId;
      }
      
      // Filtrer par aireId si fourni (pour IT)
      if (aireId) {
        filters.aireId = aireId;
      }
      
      // Ne pas filtrer par status pour permettre d'afficher tous les prestataires
      // (validés par IT, approuvés, rejetés)
      // if (status) {
      //   filters.status = status;
      // }

      console.log(`[ApprovalsService.findByZoneOrAire] Récupération avec filtres:`, filters);

      const { data: allData } = await this.dynamicTableService.getSubmissions(
        formId,
        1,
        10000, // Récupérer tous les enregistrements
        filters,
      );
      
      console.log(`[ApprovalsService.findByZoneOrAire] ${allData.length} enregistrements récupérés (sans filtre validationSequence)`);

      // Dédupliquer: pour chaque prestataire (id), garder soit l'original (validation_sequence IS NULL)
      // soit la dernière validation par IT (validation_sequence le plus élevé)
      const prestatairesMap = new Map<string, any>();
      
      for (const record of allData) {
        const prestataireId = record.id || record.submission_id || record.prestataire_id;
        if (!prestataireId) continue;
        
        const existing = prestatairesMap.get(prestataireId);
        const currentSeq = record.validation_sequence ?? 0; // NULL = 0 pour la comparaison
        const existingSeq = existing?.validation_sequence ?? 0;
        
        if (!existing) {
          // Premier enregistrement pour ce prestataire
          prestatairesMap.set(prestataireId, record);
        } else if (currentSeq > existingSeq) {
          // Le nouveau a un validation_sequence plus élevé, le garder
          prestatairesMap.set(prestataireId, record);
        } else if (currentSeq === existingSeq && currentSeq === 0) {
          // Les deux sont originaux (NULL), priorité au statut VALIDE_PAR_IT
          const currentStatus = (record.status || '').toUpperCase();
          const existingStatus = (existing.status || '').toUpperCase();
          if (currentStatus === 'VALIDE_PAR_IT' && existingStatus !== 'VALIDE_PAR_IT') {
            prestatairesMap.set(prestataireId, record);
          }
        }
      }
      
      const data = Array.from(prestatairesMap.values());
      console.log(`[ApprovalsService.findByZoneOrAire] ${data.length} prestataires uniques après déduplication (sur ${allData.length} enregistrements)`);
      
      // Log de la répartition par statut
      const statusCount = data.reduce((acc: any, p: any) => {
        const status = p.status || 'UNKNOWN';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      console.log(`[ApprovalsService.findByZoneOrAire] Répartition par statut:`, statusCount);

      console.log(`[ApprovalsService.findByZoneOrAire] formId=${formId}, zoneId=${zoneId}, aireId=${aireId}, status=${status}, total records=${data.length}`);

      // Afficher les zoneIds uniques trouvés dans les données pour le débogage
      if (data.length > 0) {
        const uniqueZoneIds = new Set<string>();
        data.forEach((record: any) => {
          const formData = record.raw_data || {};
          const recordZoneId = record.zone_id || 
                              record.zoneId || 
                              formData.zone_id || 
                              formData.zoneId || 
                              formData.admin2_h_c ||
                              record.admin2_h_c;
          if (recordZoneId) {
            uniqueZoneIds.add(recordZoneId.toString());
          }
        });
        console.log(`[ApprovalsService.findByZoneOrAire] ZoneIds uniques trouvés dans les données:`, Array.from(uniqueZoneIds));
      }

      // Filtrer par zone si fourni et transformer les données
      let filteredData = data;
      if (zoneId) {
        // Normaliser le zoneId pour la comparaison (insensible à la casse, trim)
        const normalizedZoneId = zoneId.toString().trim().toLowerCase();
        console.log(`[ApprovalsService.findByZoneOrAire] Recherche zoneId normalisé: "${normalizedZoneId}"`);
        
        // Chercher zoneId dans les données du formulaire (peut être dans raw_data ou colonne directe)
        let matchCount = 0;
        filteredData = filteredData.filter((record: any) => {
          const formData = record.raw_data || {};
          // Chercher dans plusieurs emplacements possibles
          const recordZoneId = record.zone_id || 
                              record.zoneId || 
                              formData.zone_id || 
                              formData.zoneId || 
                              formData.admin2_h_c ||
                              record.admin2_h_c;
          
          if (!recordZoneId) {
            return false;
          }
          
          // Comparaison insensible à la casse et normalisée
          const normalizedRecordZoneId = recordZoneId.toString().trim().toLowerCase();
          const matches = normalizedRecordZoneId === normalizedZoneId;
          
          if (matches) {
            matchCount++;
            if (matchCount <= 5) { // Limiter les logs aux 5 premiers matches
              console.log(`[ApprovalsService.findByZoneOrAire] Match ${matchCount}: recordZoneId="${recordZoneId}" (normalisé: "${normalizedRecordZoneId}"), status="${record.status}", approvalStatus="${record.approval_status || 'null'}"`);
            }
          }
          
          return matches;
        });
        
        console.log(`[ApprovalsService.findByZoneOrAire] Après filtrage par zone: ${filteredData.length} enregistrements`);
        
        if (filteredData.length === 0 && data.length > 0) {
          console.warn(`[ApprovalsService.findByZoneOrAire] ⚠️ ATTENTION: Aucun match trouvé pour zoneId="${zoneId}" (normalisé: "${normalizedZoneId}")`);
          console.warn(`[ApprovalsService.findByZoneOrAire] Vérifiez que le zoneId de l'utilisateur correspond bien aux zoneIds dans les données`);
        }
      } else if (!aireId) {
        console.log(`[ApprovalsService.findByZoneOrAire] Aucun zoneId ni aireId fourni, retour de tous les enregistrements`);
      }

      // Transformer pour inclure les données d'approbation
      // IMPORTANT: Ne pas filtrer par approval_status car on veut aussi voir les prestataires 
      // validés par IT qui n'ont pas encore été approuvés/rejetés par MCZ
      const transformed = filteredData
        .map((record: any) => {
          const formData = record.raw_data || {};
          Object.keys(record).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (!['id', 'submission_id', 'form_id', 'form_version', 'campaign_id', 
                  'prestataire_id', 'status', 'presence_days', 'validation_date',
                  'kyc_status', 'approval_status', 'approval_date', 'payment_status',
                  'payment_amount', 'payment_date', 'paid_at', 'parent_submission_id',
                  'validation_sequence', 'created_at', 'updated_at', 'raw_data'].includes(lowerKey)) {
              formData[key] = record[key];
            }
          });

          // Utiliser record.id (ID du prestataire) comme ID principal
          const result = {
            id: record.id, // record.id est l'ID du prestataire au format ID-YYMM-HHmm-XXX
            prestataireId: record.prestataire_id || record.id,
            approvalStatus: record.approval_status || null, // Peut être null si pas encore approuvé/rejeté
            approvalDate: record.approval_date || null,
            validationDate: record.validation_date || null, // Date de validation par IT
            validation_date: record.validation_date || null, // Date de validation par IT (snake_case)
            status: record.status,
            zoneId: record.zone_id || record.zoneId || formData.zoneId || formData.zone_id || formData.admin2_h_c,
            // Inclure les champs du formulaire pour l'affichage
            nom: record.family_name_i_c || record.nom || formData.family_name_i_c || formData.nom,
            prenom: record.given_name_i_c || record.prenom || formData.given_name_i_c || formData.prenom,
            postnom: record.middle_name_i_c || record.postnom || formData.middle_name_i_c || formData.postnom,
            telephone: record.num_phone || record.confirm_phone || record.telephone || formData.num_phone || formData.confirm_phone || formData.telephone,
            categorie: record.categorie || record.campaign_role_i_f || record.campaign_role || record.role || formData.categorie || formData.campaign_role_i_f || formData.campaign_role || formData.role,
            ...formData,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
          
          return result;
        })
        .sort((a: any, b: any) => {
          // Trier par date de création (plus récent en premier) si pas de date d'approbation
          const dateA = a.approvalDate ? new Date(a.approvalDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.approvalDate ? new Date(b.approvalDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        });
      
      console.log(`[ApprovalsService.findByZoneOrAire] Résultat final: ${transformed.length} prestataires retournés`);
      console.log(`[ApprovalsService.findByZoneOrAire] Répartition par statut:`, 
        transformed.reduce((acc: any, p: any) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {})
      );
      console.log(`[ApprovalsService.findByZoneOrAire] Répartition par approvalStatus:`, 
        transformed.reduce((acc: any, p: any) => {
          const key = p.approvalStatus || 'null';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      );
      
      return transformed;
    } catch (error) {
      console.error(`Erreur lors de la récupération des approbations depuis la table du formulaire:`, error);
      // Fallback: utiliser la méthode originale
      const query = this.approvalsRepository
        .createQueryBuilder('approval')
        .leftJoinAndSelect('approval.prestataire', 'prestataire')
        .leftJoinAndSelect('approval.mcz', 'mcz');
      
      if (zoneId) {
        query.where('prestataire.zoneId = :zoneId', { zoneId });
      }
      if (status) {
        query.andWhere('prestataire.status = :status', { status });
      }
      return query.orderBy('approval.createdAt', 'DESC').getMany();
    }
  }

  async findByPrestataire(prestataireId: string): Promise<ApprovalMCZ | null> {
    return this.approvalsRepository.findOne({
      where: { prestataireId },
      relations: ['prestataire', 'mcz'],
    });
  }
}

