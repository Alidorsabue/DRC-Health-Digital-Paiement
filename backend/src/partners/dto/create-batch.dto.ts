import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional } from 'class-validator';

export class CreateBatchDto {
  @ApiProperty({ type: [String], description: 'Liste des IDs des prestataires à inclure dans le lot' })
  @IsArray()
  @IsString({ each: true })
  prestataireIds: string[];

  @ApiProperty({ required: false, description: 'ID du partenaire (optionnel, récupéré automatiquement depuis l\'utilisateur connecté)' })
  @IsString()
  @IsOptional()
  partnerId?: string;
}

