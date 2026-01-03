import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form } from './entities/form.entity';
import { FormVersion } from './entities/form-version.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { CreateFormVersionDto } from './dto/create-form-version.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { DynamicTableService } from './dynamic-table.service';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form)
    private formsRepository: Repository<Form>,
    @InjectRepository(FormVersion)
    private formVersionsRepository: Repository<FormVersion>,
    @Inject(forwardRef(() => PrestatairesService))
    private prestatairesService: PrestatairesService,
    @Inject(forwardRef(() => CampaignsService))
    private campaignsService: CampaignsService,
    private dynamicTableService: DynamicTableService,
  ) {}

  async create(createFormDto: CreateFormDto, userId: string): Promise<Form> {
    const form = this.formsRepository.create({
      ...createFormDto,
      createdById: userId,
    });
    return this.formsRepository.save(form);
  }

  async findAll(): Promise<Form[]> {
    const forms = await this.formsRepository.find({
      relations: ['versions', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
    
    // Charger manuellement les versions si elles ne sont pas chargées par TypeORM
    for (const form of forms) {
      if (!form.versions || form.versions.length === 0) {
        const versions = await this.formVersionsRepository.find({
          where: { formId: form.id },
          order: { version: 'DESC' },
        });
        form.versions = versions;
      } else {
        // Trier les versions (ordre décroissant)
        form.versions.sort((a, b) => b.version - a.version);
      }
    }
    
    return forms;
  }

  async findOne(id: string): Promise<Form> {
    // Essayer d'abord avec findOne
    let form = await this.formsRepository.findOne({
      where: { id },
      relations: ['versions', 'createdBy'],
    });
    
    if (!form) {
      throw new NotFoundException(`Formulaire avec l'ID ${id} non trouvé`);
    }
    
    // Si les versions ne sont pas chargées, les charger manuellement
    if (!form.versions || form.versions.length === 0) {
      const versions = await this.formVersionsRepository.find({
        where: { formId: id },
        order: { version: 'DESC' },
      });
      form.versions = versions;
    }
    
    // Trier les versions par numéro de version (ordre décroissant)
    if (form.versions && form.versions.length > 0) {
      form.versions.sort((a, b) => b.version - a.version);
    }
    
    return form;
  }

  async createVersion(
    formId: string,
    createVersionDto: CreateFormVersionDto,
  ): Promise<FormVersion> {
    const form = await this.findOne(formId);
    const latestVersion = await this.getLatestVersion(formId);
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
    
    const newVersion = this.formVersionsRepository.create({
      formId,
      version: nextVersion,
      schema: createVersionDto.schema,
      isPublished: createVersionDto.isPublished || false,
    });
    
    const savedVersion = await this.formVersionsRepository.save(newVersion);
    
    return savedVersion;
  }

  async getLatestVersion(formId: string): Promise<FormVersion | null> {
    return this.formVersionsRepository.findOne({
      where: { formId },
      order: { version: 'DESC' },
    });
  }

  async getPublishedVersion(formId: string): Promise<FormVersion | null> {
    return this.formVersionsRepository.findOne({
      where: { formId, isPublished: true },
      order: { version: 'DESC' },
    });
  }

  async publishVersion(formId: string, version: number): Promise<FormVersion> {
    // Vérifier que la version existe
    const formVersion = await this.formVersionsRepository.findOne({
      where: { formId, version },
    });
    
    if (!formVersion) {
      throw new NotFoundException(`Version ${version} non trouvée pour le formulaire ${formId}`);
    }

    // Dépublicher toutes les autres versions publiées du même formulaire
    await this.formVersionsRepository.update(
      { formId, isPublished: true },
      { isPublished: false },
    );

    // Publier la version spécifiée en utilisant update pour garantir la mise à jour en DB
    const publishResult = await this.formVersionsRepository.update(
      { formId, version },
      { isPublished: true },
    );
    
    if (publishResult.affected === 0) {
      throw new Error('Échec de la publication : aucune ligne mise à jour');
    }

    // Récupérer la version mise à jour depuis la base de données
    const publishedVersion = await this.formVersionsRepository.findOne({
      where: { formId, version },
    });
    
    if (!publishedVersion) {
      throw new NotFoundException('Version publiée non trouvée après la mise à jour');
    }

    // Créer ou mettre à jour la table dynamique pour ce formulaire
    if (publishedVersion.schema) {
      try {
        await this.dynamicTableService.createOrUpdateFormTable(
          formId,
          publishedVersion.schema,
        );
        console.log(` Table dynamique créée/mise à jour pour le formulaire ${formId}`);
      } catch (error) {
        console.error(` Erreur lors de la création de la table pour ${formId}:`, error);
        // Ne pas faire échouer la publication si la création de la table échoue
        // mais logger l'erreur pour déboguer
      }
    }

    return publishedVersion;
  }

  async sendToMobile(formId: string, version: number): Promise<FormVersion> {
    // Vérifier que la version existe et est publiée
    const formVersion = await this.formVersionsRepository.findOne({
      where: { formId, version },
    });

    if (!formVersion) {
      throw new NotFoundException(`Version ${version} non trouvée pour le formulaire ${formId}`);
    }

    if (!formVersion.isPublished) {
      throw new Error('Le formulaire doit être publié avant d\'être envoyé aux mobiles');
    }

    // Marquer comme envoyé aux mobiles
    await this.formVersionsRepository.update(
      { formId, version },
      { isSentToMobile: true },
    );

    const updatedVersion = await this.formVersionsRepository.findOne({
      where: { formId, version },
    });

    if (!updatedVersion) {
      throw new NotFoundException('Version non trouvée après la mise à jour');
    }

    return updatedVersion;
  }

  async retractFromMobile(formId: string, version: number): Promise<FormVersion> {
    // Vérifier que la version existe
    const formVersion = await this.formVersionsRepository.findOne({
      where: { formId, version },
    });

    if (!formVersion) {
      throw new NotFoundException(`Version ${version} non trouvée pour le formulaire ${formId}`);
    }

    // Retirer des mobiles
    await this.formVersionsRepository.update(
      { formId, version },
      { isSentToMobile: false },
    );

    const updatedVersion = await this.formVersionsRepository.findOne({
      where: { formId, version },
    });

    if (!updatedVersion) {
      throw new NotFoundException('Version non trouvée après la mise à jour');
    }

    return updatedVersion;
  }

  async update(id: string, updateFormDto: UpdateFormDto): Promise<Form> {
    const form = await this.findOne(id);
    Object.assign(form, updateFormDto);
    return this.formsRepository.save(form);
  }

  async remove(id: string): Promise<void> {
    const form = await this.findOne(id);
    
    // Supprimer la table dynamique du formulaire si elle existe
    try {
      await this.dynamicTableService.dropFormTable(id);
    } catch (error) {
      console.error(`Erreur lors de la suppression de la table pour ${id}:`, error);
      // Ne pas faire échouer la suppression du formulaire si la table n'existe pas
    }
    
    await this.formsRepository.remove(form);
  }

  /**
   * Récupérer les champs d'un formulaire d'enregistrement pour le mapping
   * Utilisé pour les formulaires de validation
   */
  async getEnregistrementFormFields(validationFormId: string): Promise<{
    linkedFormId: string | null;
    fields: Array<{ name: string; label: string; type: string }>;
  }> {
    const validationForm = await this.findOne(validationFormId);
    
    if (!validationForm.linkedEnregistrementFormId) {
      return {
        linkedFormId: null,
        fields: [],
      };
    }

    const enregistrementForm = await this.findOne(validationForm.linkedEnregistrementFormId);
    const publishedVersion = await this.getPublishedVersion(enregistrementForm.id);

    if (!publishedVersion || !publishedVersion.schema?.properties) {
      return {
        linkedFormId: validationForm.linkedEnregistrementFormId,
        fields: [],
      };
    }

    const fields = Object.entries(publishedVersion.schema.properties).map(([name, prop]: [string, any]) => ({
      name,
      label: prop.title || name,
      type: prop['x-type'] || prop.type || 'text',
    }));

    return {
      linkedFormId: validationForm.linkedEnregistrementFormId,
      fields,
    };
  }

  /**
   * Compter le nombre de prestataires pour un formulaire donné
   * Les prestataires sont liés via les campagnes qui utilisent ce formulaire
   * OU directement via leur enregistrementData si le formulaire est d'type enregistrement
   */
  async countPrestatairesByForm(formId: string): Promise<number> {
    // Trouver toutes les campagnes qui utilisent ce formulaire
    const campaigns = await this.campaignsService.campaignsRepository.find({
      where: [
        { enregistrementFormId: formId },
        { validationFormId: formId },
      ],
    });

    let count = 0;

    if (campaigns.length > 0) {
      const campaignIds = campaigns.map(c => c.id);
      
      // Compter les prestataires pour ces campagnes
      count = await this.prestatairesService.prestatairesRepository
        .createQueryBuilder('prestataire')
        .where('prestataire.campaignId IN (:...campaignIds)', { campaignIds })
        .getCount();
    }

    return count;
  }

  /**
   * Récupérer les données des soumissions pour un formulaire donné
   * Utilise la table dynamique du formulaire
   */
  async getFormSubmissionsData(
    formId: string,
    page: number = 1,
    limit: number = 30,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    try {
      const result = await this.dynamicTableService.getSubmissions(formId, page, limit);
      return {
        data: result.data,
        total: result.total,
        page,
        limit,
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération des soumissions pour ${formId}:`, error);
      return { data: [], total: 0, page, limit };
    }
  }

  /**
   * Récupérer les données des prestataires pour un formulaire donné depuis la table du formulaire
   */
  async getPrestatairesDataByForm(
    formId: string,
    page: number = 1,
    limit: number = 30,
    filters?: Record<string, any>,
    user?: any,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      // Construire les filtres pour getSubmissions
      const submissionFilters: {
        status?: string;
        prestataireId?: string;
        campaignId?: string;
        validationSequence?: number | null;
        provinceId?: string;
        zoneId?: string;
        aireId?: string;
      } = {};

      // Filtrer par zoneId pour les utilisateurs MCZ
      if (user && user.role === 'MCZ' && user.zoneId) {
        submissionFilters.zoneId = user.zoneId;
        console.log(`[getPrestatairesDataByForm] Filtre MCZ zoneId appliqué: ${user.zoneId}`);
      }
      // Filtrer par aire de santé pour les utilisateurs IT avec scope AIRE
      else if (user && user.role === 'IT' && user.scope === 'AIRE' && user.aireId) {
        submissionFilters.aireId = user.aireId;
        console.log(`[getPrestatairesDataByForm] Filtre IT AIRE appliqué: ${user.aireId}`);
      }
      // Filtrer par zoneId pour les utilisateurs IT avec scope ZONE
      else if (user && user.role === 'IT' && user.scope === 'ZONE' && user.zoneId) {
        submissionFilters.zoneId = user.zoneId;
        console.log(`[getPrestatairesDataByForm] Filtre IT ZONE appliqué: ${user.zoneId}`);
      }
      // Filtrer par provinceId pour les utilisateurs IT avec scope PROVINCE
      else if (user && user.role === 'IT' && user.scope === 'PROVINCE' && user.provinceId) {
        submissionFilters.provinceId = user.provinceId;
        console.log(`[getPrestatairesDataByForm] Filtre IT PROVINCE appliqué: ${user.provinceId}`);
      }
      // IT sans scope ou SUPERADMIN: pas de filtre géographique (voir tous)
      else {
        console.log(`[getPrestatairesDataByForm] Aucun filtre géographique appliqué. User: role=${user?.role}, scope=${user?.scope}`);
      }

      // Par défaut, pour l'onglet DATA, retourner seulement les enregistrements originaux (validation_sequence IS NULL)
      // Pour l'onglet VALIDATION, on ne filtre pas pour voir toutes les validations
      if (filters && filters.validationSequence !== undefined) {
        submissionFilters.validationSequence = filters.validationSequence;
      } else if (filters && filters.includeValidations === true) {
        // Si includeValidations est true, ne pas filtrer (pour l'onglet VALIDATION)
        // Ne pas définir validationSequence
      } else {
        // Par défaut pour DATA, ne retourner que les prestataires uniques (sans validations multiples)
        submissionFilters.validationSequence = null;
      }

      if (filters) {
        if (filters.status) {
          submissionFilters.status = filters.status;
        }
        if (filters.prestataireId) {
          submissionFilters.prestataireId = filters.prestataireId;
        }
        if (filters.campaignId) {
          submissionFilters.campaignId = filters.campaignId;
        }
      }

      console.log(`[getPrestatairesDataByForm] formId=${formId}, filters=`, submissionFilters);

      // Récupérer depuis la table du formulaire
      const result = await this.dynamicTableService.getSubmissions(
        formId,
        page,
        limit,
        submissionFilters,
      );

      console.log(`[getPrestatairesDataByForm] result.total=${result.total}, result.data.length=${result.data.length}`);

      // Si aucun résultat avec le filtre, essayer sans filtre pour déboguer
      if (result.total === 0 && submissionFilters.validationSequence === null) {
        console.log(`[getPrestatairesDataByForm] Aucun résultat avec validationSequence=null, essai sans filtre...`);
        const resultWithoutFilter = await this.dynamicTableService.getSubmissions(
          formId,
          page,
          limit,
          {},
        );
        console.log(`[getPrestatairesDataByForm] Sans filtre: total=${resultWithoutFilter.total}, data.length=${resultWithoutFilter.data.length}`);
        
        // Si on trouve des données sans filtre, les retourner pour déboguer
        if (resultWithoutFilter.total > 0) {
          console.log(`[getPrestatairesDataByForm] ATTENTION: Des données existent mais sont exclues par le filtre validationSequence=null`);
          // Retourner les données sans filtre pour voir ce qui se passe
          const dataWithoutFilter = resultWithoutFilter.data.map((record: any) => {
            const formData = record.raw_data ? JSON.parse(JSON.stringify(record.raw_data)) : {};
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
              submissionId: record.submission_id || record.id,
              status: record.status || 'ENREGISTRE',
              campaignId: record.campaign_id,
              presenceDays: record.presence_days,
              validationDate: record.validation_date,
              kycStatus: record.kyc_status,
              approvalStatus: record.approval_status,
              paymentStatus: record.payment_status,
              paymentAmount: record.payment_amount,
              validationSequence: record.validation_sequence, // Ajouter pour déboguer
              ...formData,
              createdAt: record.created_at,
              updatedAt: record.updated_at,
            };
          });
          
          return {
            data: dataWithoutFilter,
            total: resultWithoutFilter.total,
            page,
            limit,
          };
        }
      }

      // Transformer les données pour inclure toutes les colonnes du formulaire
      const data = result.data.map((record: any) => {
        // Extraire les données du formulaire depuis raw_data ou directement depuis les colonnes
        const formData = record.raw_data ? JSON.parse(JSON.stringify(record.raw_data)) : {};
        
        // Ajouter aussi les colonnes directes si elles existent (champs du formulaire)
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
        
        // Extraire le téléphone depuis les colonnes directes ou raw_data et l'ajouter au niveau racine
        // pour faciliter l'accès depuis le frontend/mobile
        if (!record.telephone && !record.num_phone && !record.confirm_phone) {
          // Chercher dans raw_data
          if (record.raw_data && typeof record.raw_data === 'object') {
            const rawData = record.raw_data;
            record.telephone = rawData.num_phone || rawData.confirm_phone || rawData.telephone || 
                              rawData.phone || rawData.Phone || rawData.Telephone || null;
          }
        } else {
          record.telephone = record.telephone || record.num_phone || record.confirm_phone || null;
        }
        
        // Extraire le téléphone depuis les colonnes directes ou raw_data
        let telephone = record.telephone || record.num_phone || record.confirm_phone || null;
        if (!telephone && record.raw_data && typeof record.raw_data === 'object') {
          const rawData = record.raw_data;
          telephone = rawData.num_phone || rawData.confirm_phone || rawData.telephone || 
                      rawData.phone || rawData.Phone || rawData.Telephone || null;
        }
        
        // Utiliser record.id (ID du prestataire dans la table form_*) comme ID principal
        return {
          id: record.id, // record.id est l'ID du prestataire au format ID-YYMM-HHmm-XXX
          prestataireId: record.prestataire_id || record.id,
          submissionId: record.submission_id || record.id,
          status: record.status || 'ENREGISTRE', // Statut global pour compatibilité
          validationStatus: record.validation_status || record.status || 'ENREGISTRE', // Statut de validation IT (camelCase)
          validation_status: record.validation_status || record.status || 'ENREGISTRE', // Statut de validation IT (snake_case)
          campaignId: record.campaign_id,
          presenceDays: record.presence_days,
          validationDate: record.validation_date, // camelCase pour faciliter l'accès depuis le mobile
          validation_date: record.validation_date, // snake_case pour compatibilité
          kycStatus: record.kyc_status,
          kycDate: record.kyc_date,
          kyc_date: record.kyc_date,
          approvalStatus: record.approval_status,
          approvalDate: record.approval_date,
          approval_date: record.approval_date,
          paymentStatus: record.payment_status,
          paymentAmount: record.payment_amount,
          paymentDate: record.payment_date,
          payment_date: record.payment_date,
          telephone: telephone, // Ajouter le téléphone au niveau racine pour faciliter l'accès
          ...formData, // Toutes les données du formulaire
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        };
      });

      return {
        data,
        total: result.total,
        page,
        limit,
      };
    } catch (error) {
      console.error(`Erreur lors de la récupération des prestataires depuis la table du formulaire:`, error);
      return { data: [], total: 0, page, limit };
    }
  }

  /**
   * Obtenir les statistiques descriptives pour un formulaire
   */
  async getFormStatistics(formId: string): Promise<any> {
    const form = await this.findOne(formId);
    const publishedVersion = await this.getPublishedVersion(formId);
    
    if (!publishedVersion || !publishedVersion.schema) {
      return null;
    }

    const schema = publishedVersion.schema;
    const fields = Object.keys(schema.properties || {});
    
    // Récupérer toutes les données (sans pagination pour les stats)
    // Utiliser la table dynamique du formulaire
    const { data } = await this.getFormSubmissionsData(formId, 1, 10000);

    const statistics: any = {
      totalSubmissions: data.length,
      fields: {},
    };

    // Calculer les statistiques pour chaque champ
    fields.forEach(fieldName => {
      const fieldSchema = schema.properties[fieldName];
      const fieldType = fieldSchema['x-type'] || fieldSchema.type;
      const values = data.map(d => d[fieldName]).filter(v => v !== undefined && v !== null);

      if (values.length === 0) {
        statistics.fields[fieldName] = {
          type: fieldType,
          label: fieldSchema.title || fieldName,
          total: 0,
          missing: data.length,
        };
        return;
      }

      const stats: any = {
        type: fieldType,
        label: fieldSchema.title || fieldName,
        total: values.length,
        missing: data.length - values.length,
      };

      if (fieldType === 'select_one' || fieldType === 'select_multiple') {
        // Compter les occurrences de chaque valeur
        const counts: Record<string, number> = {};
        values.forEach(v => {
          if (Array.isArray(v)) {
            v.forEach(val => {
              counts[val] = (counts[val] || 0) + 1;
            });
          } else {
            counts[v] = (counts[v] || 0) + 1;
          }
        });
        stats.options = Object.entries(counts).map(([value, count]) => ({
          value,
          count,
          percentage: ((count / values.length) * 100).toFixed(2),
        })).sort((a, b) => b.count - a.count);
      } else if (fieldType === 'integer' || fieldType === 'decimal') {
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          stats.min = Math.min(...nums);
          stats.max = Math.max(...nums);
          stats.mean = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
          stats.median = nums.sort((a, b) => a - b)[Math.floor(nums.length / 2)];
        }
      } else if (fieldType === 'date' || fieldType === 'datetime') {
        const dates = values.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
        if (dates.length > 0) {
          stats.earliest = dates.sort((a, b) => a.getTime() - b.getTime())[0].toISOString();
          stats.latest = dates.sort((a, b) => b.getTime() - a.getTime())[0].toISOString();
        }
      }

      statistics.fields[fieldName] = stats;
    });

    return statistics;
  }
}

