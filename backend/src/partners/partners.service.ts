import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { PaymentsService } from '../payments/payments.service';
import { DynamicTableService } from '../forms/dynamic-table.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { FormsService } from '../forms/forms.service';
import { PrestataireStatus } from '../common/enums/status.enum';
import { PaymentStatus } from '../common/enums/status.enum';
import * as crypto from 'crypto';

@Injectable()
export class PartnersService {
  constructor(
    private prestatairesService: PrestatairesService,
    private paymentsService: PaymentsService,
    private dynamicTableService: DynamicTableService,
    private campaignsService: CampaignsService,
    private formsService: FormsService,
  ) {}

  /**
   * Récupère tous les prestataires enregistrés (statut ENREGISTRE) avec filtres optionnels
   * Pour la vérification KYC par les partenaires
   * Si aucun formId ou campaignId n'est fourni, récupère depuis tous les formulaires
   */
  async getRegisteredPrestataires(
    campaignId?: string,
    formId?: string,
    category?: string,
    provinceId?: string,
    zoneId?: string,
    aireId?: string,
  ): Promise<any[]> {
    let targetFormIds: string[] = [];
    let targetFormId = formId;
    let campaignIdToUse = campaignId;
    
    console.log(`[getRegisteredPrestataires] Appelé avec campaignId=${campaignId}, formId=${formId}`);
    
    // Si formId fourni, l'utiliser mais toujours utiliser campaignId si fourni pour filtrer
    if (targetFormId) {
      targetFormIds = [targetFormId];
      // Si campaignId est fourni avec formId, l'utiliser pour filtrer
      if (campaignId) {
        campaignIdToUse = campaignId;
      }
      console.log(`[getRegisteredPrestataires] Utilisation du formId fourni: ${targetFormId}, campaignId pour filtre: ${campaignIdToUse}`);
    } else if (campaignId) {
      // Si campaignId fourni, chercher le formulaire d'enregistrement de cette campagne
      const campaign = await this.campaignsService.findOne(campaignId);
      console.log(`[getRegisteredPrestataires] Campagne trouvée:`, { id: campaign?.id, name: campaign?.name, enregistrementFormId: campaign?.enregistrementFormId });
      if (campaign?.enregistrementFormId) {
        targetFormIds = [campaign.enregistrementFormId];
        campaignIdToUse = campaignId; // Utiliser le campaignId fourni
        console.log(`[getRegisteredPrestataires] Utilisation du formulaire de la campagne: ${campaign.enregistrementFormId}, campaignId: ${campaignIdToUse}`);
      } else {
        console.warn(`[getRegisteredPrestataires] Campagne ${campaignId} trouvée mais sans enregistrementFormId`);
      }
    } else {
      // Si aucun formId ni campaignId, essayer de trouver depuis toutes les campagnes actives
      const allCampaigns = await this.campaignsService.findAll();
      // Chercher d'abord une campagne active
      const activeCampaign = allCampaigns.find(c => c.isActive);
      console.log(`[getRegisteredPrestataires] Campagne active trouvée:`, { id: activeCampaign?.id, name: activeCampaign?.name, enregistrementFormId: activeCampaign?.enregistrementFormId });
      if (activeCampaign?.enregistrementFormId) {
        targetFormIds = [activeCampaign.enregistrementFormId];
        campaignIdToUse = activeCampaign.id; // Utiliser le campaignId de la campagne active
        console.log(`[getRegisteredPrestataires] Utilisation du formulaire de la campagne active: ${activeCampaign.enregistrementFormId}, campaignId: ${campaignIdToUse}`);
      } else if (allCampaigns.length > 0 && allCampaigns[0].enregistrementFormId) {
        // Sinon, prendre la première campagne avec un formId
        targetFormIds = [allCampaigns[0].enregistrementFormId];
        campaignIdToUse = allCampaigns[0].id;
        console.log(`[getRegisteredPrestataires] Utilisation du formulaire de la première campagne: ${allCampaigns[0].enregistrementFormId}, campaignId: ${campaignIdToUse}`);
      } else {
        // Fallback: récupérer tous les formulaires publiés si aucune campagne n'a de formId
        const allForms = await this.formsService.findAll();
        const publishedForms = allForms.filter(form => 
          form.versions?.some(v => v.isPublished)
        );
        targetFormIds = publishedForms.map(form => form.id);
        console.log(`[getRegisteredPrestataires] Fallback: utilisation de ${targetFormIds.length} formulaires publiés (sans filtre campaignId)`);
        // Pas de campaignIdToUse dans ce cas, donc on récupérera tous les prestataires de tous les formulaires
      }
    }
    
    if (targetFormIds.length === 0) {
      console.log(`[getRegisteredPrestataires] Aucun formulaire trouvé, retour vide`);
      return [];
    }
    
    console.log(`[getRegisteredPrestataires] Formulaire(s) cible(s): ${targetFormIds.join(', ')}, campaignId pour filtre: ${campaignIdToUse || 'AUCUN (tous)'}`);

    const allResults: any[] = [];

    // Chercher dans chaque formulaire
    for (const targetFormId of targetFormIds) {
      try {
        // Pour la vérification KYC, on veut voir TOUS les prestataires enregistrés originaux
        // peu importe leur statut actuel (ENREGISTRE, VALIDE_PAR_IT, etc.)
        // Car ils peuvent tous nécessiter une vérification KYC
        const filters: any = {
          validationSequence: null, // Seulement les enregistrements originaux de l'app mobile
          // Ne PAS filtrer par status pour voir tous les prestataires qui nécessitent une vérification KYC
        };
        
        // Toujours utiliser campaignIdToUse si disponible pour filtrer correctement
        if (campaignIdToUse) {
          filters.campaignId = campaignIdToUse;
          console.log(`[getRegisteredPrestataires] Filtrage par campaignId: ${campaignIdToUse}`);
        }
        if (provinceId) {
          filters.provinceId = provinceId;
        }
        if (zoneId) {
          filters.zoneId = zoneId;
        }
        if (aireId) {
          filters.aireId = aireId;
        }

        console.log(`[getRegisteredPrestataires] Recherche dans formId ${targetFormId} avec filtres:`, filters);
        const { data } = await this.dynamicTableService.getSubmissions(
          targetFormId,
          1,
          10000, // Récupérer tous les prestataires enregistrés
          filters,
        );
        console.log(`[getRegisteredPrestataires] ${data.length} prestataires trouvés dans formId ${targetFormId} (tous statuts, originaux uniquement)`);

        // Filtrer par catégorie/rôle si fourni
        let filtered = data;
        if (category) {
          filtered = data.filter((record: any) => {
            const formData = record.raw_data || {};
            const recordCategory = record.categorie || 
                                 record.campaign_role_i_f || 
                                 record.campaign_role ||
                                 record.role ||
                                 formData.categorie ||
                                 formData.campaign_role_i_f ||
                                 formData.campaign_role ||
                                 formData.role;
            
            return recordCategory === category;
          });
        }

        // Transformer les données pour un format cohérent
        const transformed = filtered.map((record: any) => {
          const formData = record.raw_data || {};
          // Fusionner les données du record avec raw_data
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

          return {
            id: record.id,
            prestataireId: record.prestataire_id || record.id,
            status: record.status,
            approvalStatus: record.approval_status,
            approvalDate: record.approval_date,
            validationDate: record.validation_date,
            kycStatus: record.kyc_status,
            paymentStatus: record.payment_status,
            paymentDate: record.payment_date || record.paid_at,
            paymentAmount: record.payment_amount || record.paymentAmount || formData.payment_amount || formData.paymentAmount,
            presenceDays: record.presence_days || record.presenceDays || formData.presence_days || formData.presenceDays,
            amountToPay: record.amount_to_pay || record.amountToPay || formData.amount_to_pay || formData.amountToPay,
            amountCurrency: record.amount_currency || record.amountCurrency || formData.amount_currency || formData.amountCurrency || 'USD',
            categorie: record.categorie || formData.categorie || formData.campaign_role_i_f || formData.campaign_role || formData.role,
            provinceId: record.province_id || record.provinceId || formData.provinceId || formData.province_id || formData.province,
            zoneId: record.zone_id || record.zoneId || formData.zoneId || formData.zone_id || formData.zone,
            aireId: record.aire_id || record.aireId || formData.aireId || formData.aire_id || formData.aire,
            // Extraire nom, prénom, postnom, téléphone depuis formData et record
            nom: record.nom || record.family_name_i_c || record.Nom || record.family_name || 
                 formData.nom || formData.family_name_i_c || formData.Nom || formData.family_name || formData.name,
            prenom: record.prenom || record.given_name_i_c || record.Prenom || record.Prénom || record.firstName ||
                    formData.prenom || formData.given_name_i_c || formData.Prenom || formData.Prénom || formData.prenom_complet || formData.firstName,
            postnom: record.postnom || record.middle_name_i_c || record.Postnom || record.post_nom || record.lastName ||
                     formData.postnom || formData.middle_name_i_c || formData.Postnom || formData.post_nom || formData.postnom_complet || formData.lastName,
            nom_complet: record.nom_complet || record.fullName || record.full_name ||
                         formData.nom_complet || formData.fullName || formData.full_name,
            telephone: record.num_phone || record.confirm_phone || record.telephone || record.Telephone ||
                       record.phone || record.Phone || record.numero_telephone || record.telephone_number || 
                       record.contact || record.numero ||
                       formData.num_phone || formData.confirm_phone || formData.telephone || formData.Telephone ||
                       formData.phone || formData.Phone || formData.numero_telephone || formData.telephone_number || 
                       formData.contact || formData.numero,
            ...formData,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        });
        
        allResults.push(...transformed);
      } catch (error) {
        console.error('Erreur lors de la récupération depuis la table du formulaire:', error);
        // Fallback vers la table prestataires
      }
    }
    
    // Si on a des résultats, les retourner
    if (allResults.length > 0) {
      console.log(`[getRegisteredPrestataires] Total: ${allResults.length} prestataires retournés`);
      return allResults;
    }

    // Fallback: utiliser la table prestataires
    console.log(`[getRegisteredPrestataires] Fallback vers table prestataires avec campaignId: ${campaignIdToUse || campaignId}`);
    const allPrestataires = await this.prestatairesService.findAll({
      campaignId: campaignIdToUse || campaignId,
      provinceId,
      zoneId,
      aireId,
      status: PrestataireStatus.ENREGISTRE,
    });

    // Filtrer par catégorie si fourni
    let filtered = allPrestataires;
    if (category) {
      filtered = allPrestataires.filter((p: any) => {
        const pCategory = p.categorie || p.role || p.campaign_role || p.campaign_role_i_f || (p.enregistrementData && p.enregistrementData.categorie);
        return pCategory === category;
      });
    }

    return filtered.map((p: any) => ({
      id: p.id,
      prestataireId: p.id,
      status: p.status,
      kycStatus: p.kycStatus,
      ...(p.enregistrementData || {}),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Récupère tous les prestataires approuvés par MCZ avec filtres optionnels
   * Cherche d'abord dans les tables de formulaires dynamiques, puis dans la table prestataires
   */
  async getApprovedPrestataires(
    campaignId?: string,
    formId?: string,
    category?: string,
    provinceId?: string,
    zoneId?: string,
    aireId?: string,
  ): Promise<any[]> {
    let targetFormId = formId;
    
    // Si formId non fourni, chercher depuis la campagne
    if (!targetFormId && campaignId) {
      const campaign = await this.campaignsService.findOne(campaignId);
      if (campaign?.enregistrementFormId) {
        targetFormId = campaign.enregistrementFormId;
      }
    }

    // Si toujours pas de formId, essayer de trouver depuis toutes les campagnes actives
    if (!targetFormId && !campaignId) {
      const allCampaigns = await this.campaignsService.findAll();
      // Chercher d'abord une campagne active
      const activeCampaign = allCampaigns.find(c => c.isActive);
      if (activeCampaign?.enregistrementFormId) {
        targetFormId = activeCampaign.enregistrementFormId;
      } else if (allCampaigns.length > 0 && allCampaigns[0].enregistrementFormId) {
        // Sinon, prendre la première campagne avec un formId
        targetFormId = allCampaigns[0].enregistrementFormId;
      }
    }

    // Si formId disponible, chercher dans la table du formulaire
    if (targetFormId) {
      try {
        const filters: any = {
          status: PrestataireStatus.APPROUVE_PAR_MCZ,
          validationSequence: null, // Seulement les enregistrements originaux
        };
        
        if (campaignId) {
          filters.campaignId = campaignId;
        }
        if (provinceId) {
          filters.provinceId = provinceId;
        }
        if (zoneId) {
          filters.zoneId = zoneId;
        }
        if (aireId) {
          filters.aireId = aireId;
        }

        const { data } = await this.dynamicTableService.getSubmissions(
          targetFormId,
          1,
          10000, // Récupérer tous les prestataires approuvés
          filters,
        );

        // Filtrer par catégorie/rôle si fourni
        let filtered = data;
        if (category) {
          filtered = data.filter((record: any) => {
            const formData = record.raw_data || {};
            const recordCategory = record.categorie || 
                                 record.campaign_role_i_f || 
                                 record.campaign_role ||
                                 record.role ||
                                 formData.categorie ||
                                 formData.campaign_role_i_f ||
                                 formData.campaign_role ||
                                 formData.role;
            
            return recordCategory === category;
          });
        }

        // Transformer les données pour un format cohérent
        return filtered.map((record: any) => {
          const formData = record.raw_data || {};
          // Fusionner les données du record avec raw_data
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

          return {
            id: record.id,
            prestataireId: record.prestataire_id || record.id,
            status: record.status,
            approvalStatus: record.approval_status,
            approvalDate: record.approval_date,
            validationDate: record.validation_date,
            kycStatus: record.kyc_status,
            paymentStatus: record.payment_status,
            paymentDate: record.payment_date || record.paid_at,
            paymentAmount: record.payment_amount || record.paymentAmount || formData.payment_amount || formData.paymentAmount,
            presenceDays: record.presence_days || record.presenceDays || formData.presence_days || formData.presenceDays,
            amountToPay: record.amount_to_pay || record.amountToPay || formData.amount_to_pay || formData.amountToPay,
            amountCurrency: record.amount_currency || record.amountCurrency || formData.amount_currency || formData.amountCurrency || 'USD',
            categorie: record.categorie || formData.categorie || formData.campaign_role_i_f || formData.campaign_role || formData.role,
            provinceId: record.province_id || record.provinceId || formData.provinceId || formData.province_id || formData.province,
            zoneId: record.zone_id || record.zoneId || formData.zoneId || formData.zone_id || formData.zone,
            aireId: record.aire_id || record.aireId || formData.aireId || formData.aire_id || formData.aire,
            // Extraire nom, prénom, postnom, téléphone depuis formData et record
            // Chercher dans plusieurs formats possibles (comme dans MCZ page)
            nom: record.nom || record.family_name_i_c || record.Nom || record.family_name || 
                 formData.nom || formData.family_name_i_c || formData.Nom || formData.family_name || formData.name,
            prenom: record.prenom || record.given_name_i_c || record.Prenom || record.Prénom || record.firstName ||
                    formData.prenom || formData.given_name_i_c || formData.Prenom || formData.Prénom || formData.prenom_complet || formData.firstName,
            postnom: record.postnom || record.middle_name_i_c || record.Postnom || record.post_nom || record.lastName ||
                     formData.postnom || formData.middle_name_i_c || formData.Postnom || formData.post_nom || formData.postnom_complet || formData.lastName,
            nom_complet: record.nom_complet || record.fullName || record.full_name ||
                         formData.nom_complet || formData.fullName || formData.full_name,
            telephone: record.num_phone || record.confirm_phone || record.telephone || record.Telephone ||
                       record.phone || record.Phone || record.numero_telephone || record.telephone_number || 
                       record.contact || record.numero ||
                       formData.num_phone || formData.confirm_phone || formData.telephone || formData.Telephone ||
                       formData.phone || formData.Phone || formData.numero_telephone || formData.telephone_number || 
                       formData.contact || formData.numero,
            ...formData,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        });
      } catch (error) {
        console.error('Erreur lors de la récupération depuis la table du formulaire:', error);
        // Fallback vers la table prestataires
      }
    }

    // Fallback: utiliser la table prestataires
    const filters: any = {
      status: PrestataireStatus.APPROUVE_PAR_MCZ,
    };
    if (campaignId) filters.campaignId = campaignId;
    if (category) filters.categorie = category;
    if (provinceId) filters.provinceId = provinceId;
    if (zoneId) filters.zoneId = zoneId;
    if (aireId) filters.aireId = aireId;

    console.log(`[getApprovedPrestataires] Fallback vers table prestataires avec filtres:`, filters);
    const allPrestataires = await this.prestatairesService.findAll(filters);
    console.log(`[getApprovedPrestataires] ${allPrestataires.length} prestataires trouvés dans la table prestataires`);

    return allPrestataires.map((p: any) => ({
      id: p.id,
      prestataireId: p.prestataireId || p.id,
      status: p.status,
      presenceDays: p.presenceDays || p.presence_days || p.enregistrementData?.presenceDays || p.enregistrementData?.presence_days,
      paymentAmount: p.paymentAmount || p.payment_amount || p.enregistrementData?.paymentAmount || p.enregistrementData?.payment_amount,
      amountToPay: p.amountToPay || p.amount_to_pay || p.enregistrementData?.amountToPay || p.enregistrementData?.amount_to_pay,
      amountCurrency: p.amountCurrency || p.amount_currency || p.enregistrementData?.amount_currency || p.enregistrementData?.amountCurrency || 'USD',
      categorie: p.categorie || p.enregistrementData?.categorie || 
                p.enregistrementData?.campaign_role_i_f || 
                p.enregistrementData?.campaign_role ||
                p.enregistrementData?.role,
      provinceId: p.provinceId,
      zoneId: p.zoneId,
      aireId: p.aireId,
      nom: p.nom,
      prenom: p.prenom,
      postnom: p.postnom,
      telephone: p.telephone,
      ...p,
    }));
  }

  /**
   * Récupère les prestataires approuvés par MCZ filtrés par catégories
   * Cherche d'abord dans les tables de formulaires dynamiques, puis dans la table prestataires
   */
  async getPrestatairesByCategories(
    categories: string[],
    campaignId?: string,
    formId?: string,
  ): Promise<any[]> {
    let targetFormId = formId;
    
    // Si formId non fourni, chercher depuis la campagne
    if (!targetFormId && campaignId) {
      const campaign = await this.campaignsService.findOne(campaignId);
      if (campaign?.enregistrementFormId) {
        targetFormId = campaign.enregistrementFormId;
      }
    }

    // Si formId disponible, chercher dans la table du formulaire
    if (targetFormId) {
      try {
        const { data } = await this.dynamicTableService.getSubmissions(
          targetFormId,
          1,
          10000, // Récupérer tous les prestataires approuvés
          {
            status: PrestataireStatus.APPROUVE_PAR_MCZ,
            campaignId,
            validationSequence: null, // Seulement les enregistrements originaux
          },
        );

        // Filtrer par catégories
        const filtered = data.filter((record: any) => {
          const formData = record.raw_data || {};
          const categorie = record.categorie || 
                           record.campaign_role_i_f || 
                           record.campaign_role ||
                           record.role ||
                           formData.categorie ||
                           formData.campaign_role_i_f ||
                           formData.campaign_role ||
                           formData.role;
          
          return categorie && categories.includes(categorie);
        });

        // Transformer les données pour un format cohérent
        return filtered.map((record: any) => {
          const formData = record.raw_data || {};
          // Fusionner les données du record avec raw_data
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

          return {
            id: record.id,
            prestataireId: record.prestataire_id || record.id,
            status: record.status,
            kycStatus: record.kyc_status,
            categorie: record.categorie || formData.categorie || formData.campaign_role_i_f || formData.campaign_role,
            ...formData,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
          };
        });
      } catch (error) {
        console.error('Erreur lors de la récupération depuis la table du formulaire:', error);
        // Fallback vers la table prestataires
      }
    }

    // Fallback: utiliser la table prestataires
    const allPrestataires = await this.prestatairesService.findAll({
      campaignId,
      status: PrestataireStatus.APPROUVE_PAR_MCZ,
    });

    return allPrestataires.filter((p) => {
      const categorie = p.categorie || p.enregistrementData?.categorie || 
                       p.enregistrementData?.campaign_role_i_f || 
                       p.enregistrementData?.campaign_role ||
                       p.enregistrementData?.role;
      return categorie && categories.includes(categorie);
    });
  }

  async createBatch(
    prestataireIds: string[],
    partnerId: string,
  ): Promise<{ batchId: string; count: number }> {
    const batchId = `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    for (const prestataireId of prestataireIds) {
      await this.paymentsService.create({
        prestataireId,
        batchId,
        partnerId,
      });
    }

    return { batchId, count: prestataireIds.length };
  }

  async notifyPayment(
    batchId: string,
    status: PaymentStatus,
    transactionId?: string,
    paymentReference?: string,
  ): Promise<void> {
    const payments = await this.paymentsService.findByBatch(batchId);

    for (const payment of payments) {
      await this.paymentsService.updatePaymentStatus(
        payment.id,
        status,
        transactionId,
        paymentReference,
      );
    }
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const calculatedSignature = hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(calculatedSignature),
    );
  }

  /**
   * Importe un rapport de paiement et met à jour les statuts de paiement des prestataires
   */
  /**
   * Importe les résultats KYC pour mettre à jour les statuts KYC des prestataires
   */
  async importKycReport(
    kycResults: Array<{
      prestataireId: string;
      status: 'CORRECT' | 'INCORRECT' | 'SANS_COMPTE';
      telephone?: string;
    }>,
    formId?: string,
  ): Promise<{ success: number; errors: Array<{ prestataireId: string; error: string }> }> {
    let targetFormId = formId;
    
    // Si formId non fourni, chercher depuis les campagnes actives
    if (!targetFormId) {
      const campaigns = await this.campaignsService.findAll();
      const activeCampaign = campaigns.find(c => c.isActive);
      if (activeCampaign?.enregistrementFormId) {
        targetFormId = activeCampaign.enregistrementFormId;
      } else if (campaigns.length > 0 && campaigns[0].enregistrementFormId) {
        targetFormId = campaigns[0].enregistrementFormId;
      }
    }

    if (!targetFormId) {
      throw new Error('formId est requis pour mettre à jour les statuts KYC');
    }

    let success = 0;
    const errors: Array<{ prestataireId: string; error: string; telephone?: string }> = [];

    console.log(`[importKycReport] Début de l'import de ${kycResults.length} résultats KYC pour formId: ${targetFormId}`);

    for (const kycResult of kycResults) {
      try {
        // Normaliser l'ID du prestataire
        const normalizedId = (kycResult.prestataireId || '').trim();
        if (!normalizedId) {
          errors.push({
            prestataireId: kycResult.prestataireId,
            error: 'ID du prestataire vide ou invalide',
            telephone: kycResult.telephone,
          });
          continue;
        }

        // Mettre à jour le statut KYC dans la table du formulaire
        await this.prestatairesService.updateKycStatus(
          normalizedId,
          kycResult.status,
          targetFormId,
          kycResult.telephone,
        );

        success++;
        console.log(`[importKycReport] ✓ Prestataire ${normalizedId} mis à jour avec statut KYC: ${kycResult.status}`);
      } catch (error: any) {
        const errorMessage = error.message || 'Erreur inconnue';
        console.error(`[importKycReport] ✗ Erreur pour prestataire ${kycResult.prestataireId}: ${errorMessage}`);
        errors.push({
          prestataireId: kycResult.prestataireId,
          error: errorMessage,
          telephone: kycResult.telephone,
        });
      }
    }

    console.log(`[importKycReport] Import terminé: ${success} succès, ${errors.length} erreurs`);
    return { success, errors };
  }

  async importPaymentReport(
    payments: Array<{
      prestataireId: string;
      status: PaymentStatus;
      paymentDate?: string;
      transactionId?: string;
      paymentReference?: string;
      paymentAmount?: number;
    }>,
    formId?: string,
  ): Promise<{ success: number; errors: Array<{ prestataireId: string; error: string }> }> {
    const errors: Array<{ prestataireId: string; error: string }> = [];
    let success = 0;

    // Trouver le formId si non fourni
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

    for (const payment of payments) {
      try {
        // Mettre à jour directement dans la table du formulaire si formId disponible
        if (targetFormId) {
          console.log(`[importPaymentReport] Recherche du prestataire ${payment.prestataireId} dans formId ${targetFormId}`);
          
          // Récupérer les données du prestataire pour trouver le campaignId
          // Ne pas filtrer par status pour trouver le prestataire même si son statut a changé
          const { data } = await this.dynamicTableService.getSubmissions(
            targetFormId,
            1,
            100,
            { prestataireId: payment.prestataireId },
          );

          console.log(`[importPaymentReport] ${data.length} enregistrements trouvés pour prestataire ${payment.prestataireId}`);

          let campaignId: string | undefined;
          if (data && data.length > 0) {
            // Chercher d'abord les enregistrements avec statut APPROUVE_PAR_MCZ
            let prestataireRecord = data.find((r: any) => 
              r.validation_sequence != null && r.status === 'APPROUVE_PAR_MCZ'
            ) || data.find((r: any) => r.validation_sequence == null && r.status === 'APPROUVE_PAR_MCZ');
            
            // Si pas trouvé, prendre le premier enregistrement trouvé
            if (!prestataireRecord) {
              prestataireRecord = data[0];
            }
            
            if (prestataireRecord) {
              campaignId = prestataireRecord.campaign_id || prestataireRecord.campaignId;
              console.log(`[importPaymentReport] Prestataire trouvé, campaignId: ${campaignId}, status: ${prestataireRecord.status}`);
            }
          } else {
            console.warn(`[importPaymentReport] Aucun enregistrement trouvé pour prestataire ${payment.prestataireId}`);
          }

          // Mettre à jour dans la table du formulaire
          const paymentDate = payment.paymentDate ? new Date(payment.paymentDate).toISOString() : new Date().toISOString();
          const paymentAmount = payment.paymentAmount || 0;

          await this.dynamicTableService.updatePaymentInTable(
            targetFormId,
            payment.prestataireId,
            payment.status,
            paymentAmount,
            paymentDate,
            payment.transactionId,
            campaignId,
          );
        }

        // Mettre à jour aussi dans la table payments si existe
        const existingPayments = await this.paymentsService.findByPrestataire(payment.prestataireId);
        if (existingPayments && existingPayments.length > 0) {
          await this.paymentsService.updatePaymentStatus(
            existingPayments[0].id,
            payment.status,
            payment.transactionId,
            payment.paymentReference,
            targetFormId,
          );
        }

        success++;
      } catch (error: any) {
        errors.push({
          prestataireId: payment.prestataireId,
          error: error.message || 'Erreur inconnue',
        });
      }
    }

    return { success, errors };
  }

  /**
   * Importe des prestataires depuis le système partenaire
   */
  async importPrestataires(
    prestataires: Array<{
      nom?: string;
      prenom?: string;
      postnom?: string;
      telephone: string;
      email?: string;
      categorie: string;
      zoneId?: string;
      aireId?: string;
      campaignId?: string;
      externalId?: string;
      customData?: any;
    }>,
    formId?: string,
    campaignId?: string,
    partnerId?: string,
  ): Promise<{ success: number; errors: Array<{ prestataire: any; error: string }> }> {
    const errors: Array<{ prestataire: any; error: string }> = [];
    let success = 0;

    // Si formId fourni, importer dans la table du formulaire
    if (formId) {
      // TODO: Implémenter l'import dans la table du formulaire dynamique
      // Cela nécessiterait d'utiliser DynamicTableService pour créer des enregistrements
      throw new Error('L\'import dans les tables de formulaires dynamiques n\'est pas encore implémenté');
    }

    // Sinon, importer dans la table prestataires
    // Pour l'instant, cette fonctionnalité nécessite d'être implémentée différemment
    // car create() nécessite userId et userScope qui ne sont pas disponibles ici
    // TODO: Implémenter une méthode dédiée dans PrestatairesService pour l'import depuis partenaires
    throw new Error('L\'import de prestataires depuis les partenaires doit être implémenté via une méthode dédiée dans PrestatairesService');

    return { success, errors };
  }

  /**
   * Met à jour les montants à payer pour les prestataires
   */
  async updatePaymentAmounts(
    amounts: Array<{ prestataireId: string; amount: number; currency?: string }>,
    formId?: string,
  ): Promise<{ success: number; errors: Array<{ prestataireId: string; error: string }> }> {
    let targetFormId = formId;
    
    // Si formId non fourni, chercher depuis les campagnes actives
    if (!targetFormId) {
      const campaigns = await this.campaignsService.findAll();
      const activeCampaign = campaigns.find(c => c.isActive);
      if (activeCampaign?.enregistrementFormId) {
        targetFormId = activeCampaign.enregistrementFormId;
      } else if (campaigns.length > 0 && campaigns[0].enregistrementFormId) {
        targetFormId = campaigns[0].enregistrementFormId;
      }
    }

    if (!targetFormId) {
      throw new Error('formId est requis pour mettre à jour les montants à payer');
    }

    let success = 0;
    const errors: Array<{ prestataireId: string; error: string }> = [];

    for (const amountData of amounts) {
      try {
        // Mettre à jour le montant dans la table du formulaire
        await this.dynamicTableService.updateAmountInTable(
          targetFormId,
          amountData.prestataireId,
          amountData.amount,
          amountData.currency,
        );

        success++;
      } catch (error: any) {
        errors.push({
          prestataireId: amountData.prestataireId,
          error: error.message || 'Erreur inconnue',
        });
      }
    }

    return { success, errors };
  }
}

