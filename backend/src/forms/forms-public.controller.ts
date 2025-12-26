import { Controller, Get, Post, Body, Param, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { DynamicTableService } from './dynamic-table.service';
import { SubmitFormDto } from './dto/submit-form.dto';
import { Public } from '../common/decorators/public.decorator';
import { generateSubmissionId } from '../common/utils/id-generator.util';
import { DataSource } from 'typeorm';

@ApiTags('Forms Public')
@Controller('forms/public')
export class FormsPublicController {
  constructor(
    private readonly formsService: FormsService,
    private readonly dynamicTableService: DynamicTableService,
    private readonly dataSource: DataSource,
  ) {}

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtenir un formulaire publié (public)' })
  async getPublishedForm(@Param('id') id: string) {
    const form = await this.formsService.findOne(id);
    
    // Vérifier que le formulaire existe et a une version publiée
    const publishedVersion = await this.formsService.getPublishedVersion(id);
    if (!publishedVersion) {
      throw new NotFoundException('Formulaire non publié ou introuvable');
    }

    return {
      id: form.id,
      name: form.name,
      description: form.description,
      type: form.type,
      version: publishedVersion.version,
      schema: publishedVersion.schema,
    };
  }

  @Post(':id/submit')
  @Public()
  @ApiOperation({ summary: 'Soumettre les données d\'un formulaire publié (public)' })
  async submitForm(@Param('id') id: string, @Body() submitFormDto: SubmitFormDto) {
    // Vérifier que le formulaire existe et est publié
    const form = await this.formsService.findOne(id);
    const publishedVersion = await this.formsService.getPublishedVersion(id);
    
    if (!publishedVersion) {
      throw new NotFoundException('Formulaire non publié ou introuvable');
    }

    // Valider les données selon le schéma (validation basique)
    const schema = publishedVersion.schema;
    if (!schema || !schema.properties) {
      throw new BadRequestException('Schéma du formulaire invalide');
    }

    // Fonction helper pour vérifier si un champ est visible selon ses dépendances
    const isFieldVisible = (fieldName: string): boolean => {
      const fieldSchema = schema.properties[fieldName];
      if (!fieldSchema) return false;
      
      // Si le champ n'a pas de dépendance, il est visible
      const dependsOn = fieldSchema['x-dependsOn'];
      if (!dependsOn) return true;
      
      // Vérifier si la valeur de dépendance correspond
      const dependsValue = fieldSchema['x-dependsValue'];
      const actualValue = submitFormDto.data[dependsOn];
      
      return actualValue?.toString() === dependsValue?.toString();
    };

    // Vérifier les champs requis SEULEMENT pour les champs visibles
    const requiredFields = schema.required || [];
    for (const field of requiredFields) {
      // Ne valider que si le champ est visible
      if (isFieldVisible(field)) {
        const fieldValue = submitFormDto.data[field];
        // Vérifier si la valeur est vide (null, undefined, chaîne vide, tableau vide, objet vide)
        const isEmpty = 
          fieldValue === null || 
          fieldValue === undefined || 
          (typeof fieldValue === 'string' && fieldValue.trim() === '') ||
          (Array.isArray(fieldValue) && fieldValue.length === 0) ||
          (typeof fieldValue === 'object' && Object.keys(fieldValue).length === 0);
        
        if (isEmpty) {
          // Obtenir le label du champ pour un message d'erreur plus clair
          const fieldSchema = schema.properties[field];
          const fieldLabel = fieldSchema?.['title'] || fieldSchema?.['x-label'] || field;
          throw new BadRequestException(`Le champ "${fieldLabel}" est obligatoire`);
        }
      }
    }

    // S'assurer que la table est à jour (met à jour les contraintes NOT NULL pour les champs conditionnels)
    await this.dynamicTableService.createOrUpdateFormTable(id, schema);

    // Transformer les valeurs techniques des champs select en libellés
    const transformedData = this.transformSelectValuesToLabels(submitFormDto.data, schema);

    // Générer un ID unique pour la soumission au format ID-YYMM-HHmm-XXX
    const submissionId = await generateSubmissionId(this.dataSource, id);

    try {
      // Insérer la soumission dans la table dynamique du formulaire
      await this.dynamicTableService.insertSubmission(
        id,
        publishedVersion.version,
        submissionId,
        transformedData,
        submitFormDto.campaignId,
      );

      console.log(` Soumission ${submissionId} enregistrée dans la table du formulaire ${id}`);

      // Note: Les données sont maintenant stockées dans la table dynamique du formulaire
      // Pour les formulaires d'enregistrement, les données sont accessibles via la table du formulaire

      return {
        success: true,
        message: 'Formulaire soumis avec succès',
        submissionId,
      };
    } catch (error) {
      console.error(' Erreur lors de l\'enregistrement de la soumission:', error);
      throw new BadRequestException(`Erreur lors de l'enregistrement: ${error.message}`);
    }
  }

  /**
   * Transforme les valeurs techniques des champs select en libellés
   * Pour select_one: remplace la valeur technique par le libellé
   * Pour select_multiple: remplace chaque valeur technique par son libellé
   */
  private transformSelectValuesToLabels(data: Record<string, any>, schema: any): Record<string, any> {
    const transformed = { ...data };
    const properties = schema.properties || {};

    for (const [fieldName, fieldValue] of Object.entries(data)) {
      const fieldSchema = properties[fieldName];
      if (!fieldSchema) continue;

      const fieldType = fieldSchema['x-type'] || fieldSchema.type;
      const isSelectOne = fieldType === 'select_one' || (fieldSchema.type === 'string' && fieldSchema.enum);
      const isSelectMultiple = fieldType === 'select_multiple' || (fieldSchema.type === 'array' && fieldSchema.items?.enum);

      if (isSelectOne && fieldValue != null) {
        // Pour select_one, remplacer la valeur technique par le libellé
        const options = fieldSchema['x-options'] || [];
        const option = options.find((opt: any) => opt.value === fieldValue || opt.value === String(fieldValue));
        if (option && option.label) {
          transformed[fieldName] = option.label;
        }
      } else if (isSelectMultiple && Array.isArray(fieldValue)) {
        // Pour select_multiple, remplacer chaque valeur technique par son libellé
        const options = fieldSchema['x-options'] || fieldSchema.items?.['x-options'] || [];
        transformed[fieldName] = fieldValue.map((val: any) => {
          const option = options.find((opt: any) => opt.value === val || opt.value === String(val));
          return option && option.label ? option.label : val;
        });
      }
    }

    return transformed;
  }
}

