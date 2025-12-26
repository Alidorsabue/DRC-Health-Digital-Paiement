import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsEnum, IsOptional, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../common/enums/status.enum';

export class PaymentReportRowDto {
  @ApiProperty({ description: 'ID du prestataire' })
  @IsString()
  prestataireId: string;

  @ApiProperty({ description: 'Statut du paiement', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiProperty({ description: 'Date de paiement', required: false })
  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @ApiProperty({ description: 'Montant du paiement', required: false })
  @IsNumber()
  @IsOptional()
  paymentAmount?: number;

  @ApiProperty({ description: 'ID de transaction', required: false })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiProperty({ description: 'Référence de paiement', required: false })
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

export class ImportPaymentReportDto {
  @ApiProperty({ type: [PaymentReportRowDto], description: 'Liste des rapports de paiement' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentReportRowDto)
  payments: PaymentReportRowDto[];
}
