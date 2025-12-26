import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalDecision } from '../entities/approval-mcz.entity';

export class CreateApprovalDto {
  @ApiProperty({ enum: ApprovalDecision })
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  commentaire?: string;
}

