import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdatePrestataireDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  nom?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  prenom?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  postnom?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  categorie?: string;
}

