import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsBoolean, IsOptional } from 'class-validator';

export class CreateFormVersionDto {
  @ApiProperty({ description: 'JSON Schema du formulaire' })
  @IsObject()
  schema: Record<string, any>;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

