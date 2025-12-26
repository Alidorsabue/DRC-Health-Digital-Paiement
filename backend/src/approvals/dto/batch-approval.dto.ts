import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class BatchApprovalDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  prestataireIds: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  commentaire?: string;
}

