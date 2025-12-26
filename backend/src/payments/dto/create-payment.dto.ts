import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsUUID()
  prestataireId: string;

  @ApiProperty()
  @IsString()
  batchId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partnerId?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  amount?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

