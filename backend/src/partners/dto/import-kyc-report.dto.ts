import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum KycStatus {
  CORRECT = 'CORRECT',
  INCORRECT = 'INCORRECT',
  SANS_COMPTE = 'SANS_COMPTE',
}

export class KycReportRowDto {
  @ApiProperty({ description: "ID du prestataire (prestataireId)" })
  @IsString()
  @IsNotEmpty()
  prestataireId: string;

  @ApiProperty({ 
    description: 'Statut KYC', 
    enum: KycStatus,
    example: KycStatus.CORRECT 
  })
  @IsEnum(KycStatus)
  @IsNotEmpty()
  status: KycStatus;

  @ApiProperty({ description: 'Numéro de téléphone (optionnel, requis si différent de celui enregistré)', required: false })
  @IsString()
  @IsOptional()
  telephone?: string;
}

export class ImportKycReportDto {
  @ApiProperty({ 
    description: 'Liste des résultats KYC',
    type: [KycReportRowDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KycReportRowDto)
  kycResults: KycReportRowDto[];
}

