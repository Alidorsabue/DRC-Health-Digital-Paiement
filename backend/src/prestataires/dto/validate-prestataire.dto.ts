import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsInt, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class ValidatePrestataireDto {
  @ApiProperty({ description: 'Nombre de jours de présence', minimum: 0 })
  @IsNumber()
  @IsInt()
  @Min(0)
  presenceDays: number;

  @ApiProperty({ 
    description: 'Date de validation (ISO 8601)', 
    required: false,
    example: '2025-01-15T10:30:00Z'
  })
  @IsOptional()
  @IsDateString()
  validationDate?: string;

  @ApiProperty({ 
    description: 'ID de la campagne', 
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

