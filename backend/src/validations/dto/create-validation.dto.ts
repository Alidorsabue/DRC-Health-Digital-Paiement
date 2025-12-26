import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';

export class CreateValidationDto {
  @ApiProperty({ description: 'Nombre de jours prestés' })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  joursPrestes: number;

  @ApiProperty({ required: false, description: 'URL ou base64 de la preuve de présence' })
  @IsString()
  @IsOptional()
  preuvePresence?: string;

  @ApiProperty({ description: 'Signature numérique du prestataire (base64)' })
  @IsString()
  @IsNotEmpty()
  signaturePrestataire: string;

  @ApiProperty({ required: false, description: 'Données supplémentaires du formulaire de validation' })
  @IsObject()
  @IsOptional()
  validationData?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  commentaire?: string;
}

