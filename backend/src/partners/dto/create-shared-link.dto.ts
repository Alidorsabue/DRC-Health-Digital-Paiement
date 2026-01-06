import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsArray, Min, Max } from 'class-validator';

export class CreateSharedLinkDto {
  @ApiProperty({ description: 'ID de la campagne', required: false })
  @IsOptional()
  @IsString()
  campaignId?: string;

  @ApiProperty({ description: 'ID du formulaire', required: false })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiProperty({ description: 'Catégorie(s) de prestataires', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiProperty({ description: 'ID de la province', required: false })
  @IsOptional()
  @IsString()
  provinceId?: string;

  @ApiProperty({ description: 'ID de la zone de santé', required: false })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiProperty({ description: 'ID de l\'aire de santé', required: false })
  @IsOptional()
  @IsString()
  aireId?: string;

  @ApiProperty({ description: 'Durée de vie du lien en heures (défaut: 168 = 7 jours)', required: false, minimum: 1, maximum: 720 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(720) // Maximum 30 jours
  expiresInHours?: number;

  @ApiProperty({ description: 'Inclure le calcul des montants', required: false, default: true })
  @IsOptional()
  includeAmountCalculation?: boolean;
}

