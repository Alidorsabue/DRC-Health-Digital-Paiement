import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class SubmitFormDto {
  @ApiProperty({ description: 'ID de la campagne (optionnel pour les soumissions publiques)' })
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @ApiProperty({ description: 'Données du formulaire (correspondant au schéma JSON)' })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;
}

