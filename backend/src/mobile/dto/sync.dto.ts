import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsArray, IsUUID } from 'class-validator';
import { CreatePrestataireDto } from '../../prestataires/dto/create-prestataire.dto';
import { CreateValidationDto } from '../../validations/dto/create-validation.dto';

export class SyncDto {
  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  downloadForms?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  downloadCampaigns?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  downloadPrestataires?: boolean;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  uploadPrestataires?: boolean;

  @ApiProperty({ type: [CreatePrestataireDto], required: false })
  @IsArray()
  @IsOptional()
  prestataires?: CreatePrestataireDto[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  uploadValidations?: boolean;

  @ApiProperty({ type: [CreateValidationDto], required: false })
  @IsArray()
  @IsOptional()
  validations?: (CreateValidationDto & { prestataireId: string })[];
}

