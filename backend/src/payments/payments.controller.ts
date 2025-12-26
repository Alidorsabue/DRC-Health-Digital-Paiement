import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('prestataires/:prestataireId')
  @ApiOperation({ summary: 'Obtenir les paiements d\'un prestataire' })
  findByPrestataire(@Param('prestataireId') prestataireId: string) {
    return this.paymentsService.findByPrestataire(prestataireId);
  }

  @Get('batch/:batchId')
  @ApiOperation({ summary: 'Obtenir les paiements d\'un lot' })
  findByBatch(@Param('batchId') batchId: string) {
    return this.paymentsService.findByBatch(batchId);
  }
}

