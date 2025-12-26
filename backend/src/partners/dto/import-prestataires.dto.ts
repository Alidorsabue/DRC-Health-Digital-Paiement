import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsOptional, IsEmail, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportPrestataireDto {
  @ApiProperty({ description: 'Nom de famille', required: false })
  @IsString()
  @IsOptional()
  nom?: string;

  @ApiProperty({ description: 'Prénom', required: false })
  @IsString()
  @IsOptional()
  prenom?: string;

  @ApiProperty({ description: 'Postnom', required: false })
  @IsString()
  @IsOptional()
  postnom?: string;

  @ApiProperty({ description: 'Numéro de téléphone' })
  @IsString()
  telephone: string;

  @ApiProperty({ description: 'Email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Rôle/Catégorie du prestataire' })
  @IsString()
  categorie: string;

  @ApiProperty({ description: 'ID de la zone de santé', required: false })
  @IsString()
  @IsOptional()
  zoneId?: string;

  @ApiProperty({ description: 'ID de l\'aire de santé', required: false })
  @IsString()
  @IsOptional()
  aireId?: string;

  @ApiProperty({ description: 'ID de la campagne', required: false })
  @IsString()
  @IsOptional()
  campaignId?: string;

  @ApiProperty({ description: 'ID externe du prestataire dans le système partenaire', required: false })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiProperty({ description: 'Autres données personnalisées', required: false })
  @IsOptional()
  customData?: any;
}

export class ImportPrestatairesDto {
  @ApiProperty({ type: [ImportPrestataireDto], description: 'Liste des prestataires à importer' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportPrestataireDto)
  prestataires: ImportPrestataireDto[];

  @ApiProperty({ description: 'ID du formulaire d\'enregistrement', required: false })
  @IsString()
  @IsOptional()
  formId?: string;

  @ApiProperty({ description: 'ID de la campagne', required: false })
  @IsString()
  @IsOptional()
  campaignId?: string;
}
