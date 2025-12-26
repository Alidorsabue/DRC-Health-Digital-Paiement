import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsObject,
} from 'class-validator';

export class CreatePrestataireDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  prenom: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  categorie?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  provinceId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  zoneId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aireId?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  enregistrementData?: Record<string, any>;
}

