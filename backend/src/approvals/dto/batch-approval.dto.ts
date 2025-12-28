import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, ArrayMinSize, IsNotEmpty, IsUUID } from 'class-validator';

export class BatchApprovalDto {
  @ApiProperty({ type: [String], description: 'Liste des IDs des prestataires à approuver/rejeter' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un prestataire doit être sélectionné' })
  @IsString({ each: true, message: 'Chaque ID doit être une chaîne de caractères' })
  @IsNotEmpty({ each: true, message: 'Chaque ID ne peut pas être vide' })
  prestataireIds: string[];

  @ApiProperty({ required: false, description: 'ID du formulaire (optionnel, récupéré automatiquement si non fourni)' })
  @IsUUID('4', { message: 'formId doit être un UUID valide' })
  @IsOptional()
  formId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  commentaire?: string;
}

