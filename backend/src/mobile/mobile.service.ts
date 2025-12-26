import { Injectable } from '@nestjs/common';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { ValidationsService } from '../validations/validations.service';
import { FormsService } from '../forms/forms.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { SyncDto } from './dto/sync.dto';
import { PrestataireStatus } from '../common/enums/status.enum';
import { GeographicScope } from '../common/enums/geographic-scope.enum';

@Injectable()
export class MobileService {
  constructor(
    private prestatairesService: PrestatairesService,
    private validationsService: ValidationsService,
    private formsService: FormsService,
    private campaignsService: CampaignsService,
  ) {}

  async sync(syncDto: SyncDto, userId: string, aireId: string) {
    const result: any = {
      downloaded: {
        forms: [],
        campaigns: [],
        prestataires: [],
      },
      uploaded: {
        prestataires: [],
        validations: [],
      },
    };

    if (syncDto.downloadForms) {
      const forms = await this.formsService.findAll();
      const formsWithPublishedVersions = await Promise.all(
        forms.map(async (form) => {
          const publishedVersion = await this.formsService.getPublishedVersion(form.id);
          return {
            id: form.id,
            name: form.name,
            description: form.description,
            type: form.type,
            createdAt: form.createdAt,
            updatedAt: form.updatedAt,
            latestVersion: publishedVersion,
          };
        }),
      );
      // Filtrer pour ne retourner que les formulaires qui ont une version publiée ET envoyée aux mobiles
      result.downloaded.forms = formsWithPublishedVersions.filter(
        (form) => form.latestVersion !== null && form.latestVersion.isSentToMobile === true,
      );
    }

    if (syncDto.downloadCampaigns) {
      const campaigns = await this.campaignsService.findAll();
      result.downloaded.campaigns = campaigns.filter((c) => c.isActive);
    }

    if (syncDto.downloadPrestataires) {
      const prestataires = await this.prestatairesService.findAll({
        aireId,
        campaignId: syncDto.campaignId,
      });
      result.downloaded.prestataires = prestataires;
    }

    if (syncDto.uploadPrestataires && syncDto.prestataires) {
      for (const prestataireData of syncDto.prestataires) {
        const prestataire = await this.prestatairesService.create(
          prestataireData,
          userId,
          GeographicScope.AIRE,
          aireId,
        );
        result.uploaded.prestataires.push(prestataire);
      }
    }

    if (syncDto.uploadValidations && syncDto.validations) {
      for (const validationData of syncDto.validations) {
        const validation = await this.validationsService.create(
          validationData.prestataireId,
          validationData,
          userId,
        );
        result.uploaded.validations.push(validation);
      }
    }

    return result;
  }

  async getPrestatairesForValidation(
    campaignId: string,
    aireId: string,
  ): Promise<any[]> {
    // Utiliser findPendingValidation qui récupère directement depuis les tables de formulaires
    // Chercher le formId depuis la campagne
    let targetFormId: string | undefined;
    const campaign = await this.campaignsService.findOne(campaignId);
    if (campaign?.enregistrementFormId) {
      targetFormId = campaign.enregistrementFormId;
    }

    // Créer un objet user mock pour passer l'aireId à findPendingValidation
    const user = { role: 'IT', scope: 'AIRE', aireId };
    
    // Passer campaignId à findPendingValidation pour filtrer directement
    const prestataires = await this.prestatairesService.findPendingValidation(targetFormId, user, campaignId);

    // Ne retourner que ceux avec status ENREGISTRE (pas encore validés)
    return prestataires
      .filter((p: any) => {
        const status = p.status || 'ENREGISTRE';
        return status === PrestataireStatus.ENREGISTRE;
      })
      .map((p: any) => ({
        id: p.id || p.prestataireId,
        nom: p.nom || p.family_name_i_c || p.Nom || '',
        prenom: p.prenom || p.given_name_i_c || p.Prenom || '',
        categorie: p.categorie || p.campaign_role_i_f || p.campaign_role || p.role || '',
        enregistrementData: p.enregistrementData || p.raw_data || {},
      }));
  }
}

