import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { PaymentNotificationDto } from './dto/payment-notification.dto';
import { ImportPaymentReportDto } from './dto/import-payment-report.dto';
import { ImportPrestatairesDto } from './dto/import-prestataires.dto';
import { ImportKycReportDto } from './dto/import-kyc-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('Partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARTNER)
@Controller('partner')
export class PartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private configService: ConfigService,
  ) {}

  @Get('prestataires')
  @ApiOperation({ summary: 'Obtenir les prestataires approuvés par MCZ (avec filtres optionnels)' })
  getPrestataires(
    @Query('categories') categories?: string,
    @Query('category') category?: string,
    @Query('campaignId') campaignId?: string,
    @Query('formId') formId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('aireId') aireId?: string,
    @CurrentUser() user?: any,
  ) {
    // Si categories est fourni (ancienne API), utiliser getPrestatairesByCategories
    if (categories) {
      const categoriesList = categories.split(',').map(c => c.trim());
      return this.partnersService.getPrestatairesByCategories(
        categoriesList,
        campaignId,
        formId,
      );
    }
    
    // Sinon, utiliser la nouvelle API avec filtres optionnels
    return this.partnersService.getApprovedPrestataires(
      campaignId,
      formId,
      category,
      provinceId,
      zoneId,
      aireId,
    );
  }

  @Get('prestataires/enregistres')
  @ApiOperation({ summary: 'Obtenir les prestataires enregistrés (pour vérification KYC) avec filtres optionnels' })
  getRegisteredPrestataires(
    @Query('category') category?: string,
    @Query('campaignId') campaignId?: string,
    @Query('formId') formId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('aireId') aireId?: string,
  ) {
    return this.partnersService.getRegisteredPrestataires(
      campaignId,
      formId,
      category,
      provinceId,
      zoneId,
      aireId,
    );
  }

  @Post('batches')
  @ApiOperation({ summary: 'Créer un lot de paiement' })
  createBatch(
    @Body() createBatchDto: CreateBatchDto,
    @CurrentUser() user?: any,
  ) {
    // Utiliser le partnerId de l'utilisateur connecté
    const partnerId = user?.partnerId || createBatchDto.partnerId;
    
    if (!partnerId) {
      throw new Error('Le partnerId est requis');
    }
    
    return this.partnersService.createBatch(
      createBatchDto.prestataireIds,
      partnerId,
    );
  }

  @Post('payment-notification')
  @ApiOperation({ summary: 'Notifier le paiement via webhook HMAC' })
  @ApiHeader({ name: 'X-Webhook-Signature', required: true })
  notifyPayment(
    @Body() paymentNotificationDto: PaymentNotificationDto,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const secret = this.configService.get<string>('WEBHOOK_SECRET', '');
    const payload = JSON.stringify(paymentNotificationDto);

    if (
      !this.partnersService.verifyWebhookSignature(payload, signature, secret)
    ) {
      throw new Error('Signature invalide');
    }

    return this.partnersService.notifyPayment(
      paymentNotificationDto.batchId,
      paymentNotificationDto.status,
      paymentNotificationDto.transactionId,
      paymentNotificationDto.paymentReference,
    );
  }

  @Post('import/payment-report')
  @ApiOperation({ summary: 'Importer un rapport de paiement pour mettre à jour les statuts de paiement' })
  importPaymentReport(
    @Body() importDto: ImportPaymentReportDto,
    @Query('formId') formId?: string,
  ) {
    return this.partnersService.importPaymentReport(
      importDto.payments,
      formId,
    );
  }

  @Post('import/prestataires')
  @ApiOperation({ summary: 'Importer des prestataires depuis le système partenaire' })
  importPrestataires(
    @Body() importDto: ImportPrestatairesDto,
    @CurrentUser() user?: any,
  ) {
    return this.partnersService.importPrestataires(
      importDto.prestataires,
      importDto.formId,
      importDto.campaignId,
      user?.partnerId,
    );
  }

  @Post('import/kyc-report')
  @ApiOperation({ summary: 'Importer un rapport de résultats KYC pour mettre à jour les statuts KYC des prestataires' })
  importKycReport(
    @Body() importDto: ImportKycReportDto,
    @Query('formId') formId?: string,
  ) {
    return this.partnersService.importKycReport(
      importDto.kycResults,
      formId,
    );
  }

  @Post('payment-amounts')
  @ApiOperation({ summary: 'Mettre à jour les montants à payer pour les prestataires' })
  updatePaymentAmounts(
    @Body() dto: { amounts: Array<{ prestataireId: string; amount: number; currency?: string }> },
    @Query('formId') formId?: string,
  ) {
    return this.partnersService.updatePaymentAmounts(dto.amounts, formId);
  }
}

