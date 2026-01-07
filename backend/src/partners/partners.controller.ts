import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { PartnersService } from './partners.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { PaymentNotificationDto } from './dto/payment-notification.dto';
import { ImportPaymentReportDto } from './dto/import-payment-report.dto';
import { ImportPrestatairesDto } from './dto/import-prestataires.dto';
import { ImportKycReportDto } from './dto/import-kyc-report.dto';
import { CreateSharedLinkDto } from './dto/create-shared-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
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

  @Post('shared-link')
  @ApiOperation({ summary: 'Créer un lien public partageable pour les données filtrées' })
  async createSharedLink(
    @Body() dto: CreateSharedLinkDto,
    @CurrentUser() user?: any,
  ) {
    const expiresInHours = dto.expiresInHours || 168; // 7 jours par défaut
    
    return this.partnersService.createSharedLink(
      {
        campaignId: dto.campaignId,
        formId: dto.formId,
        categories: dto.categories,
        provinceId: dto.provinceId,
        zoneId: dto.zoneId,
        aireId: dto.aireId,
        includeAmountCalculation: dto.includeAmountCalculation !== false, // true par défaut
      },
      expiresInHours,
      user?.partnerId,
    );
  }
}

/**
 * Controller public pour les données partagées (sans authentification)
 */
@ApiTags('Partners Public')
@Controller('partner/public')
export class PartnersPublicController {
  constructor(
    private readonly partnersService: PartnersService,
  ) {}

  @Get('prestataires/:token')
  @Public()
  @ApiOperation({ summary: 'Récupérer les prestataires filtrés via un lien public partagé' })
  async getSharedPrestataires(
    @Param('token') token: string,
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const prestataires = await this.partnersService.getSharedPrestataires(token);
    
    const requestedFormat = (format || '').toLowerCase();
    
    if (requestedFormat === 'csv') {
      const csv = this.partnersService.convertToCSV(prestataires);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="prestataires-${token.substring(0, 8)}.csv"`);
      return res.send(csv);
    }
    
    if (requestedFormat === 'excel' || requestedFormat === 'xlsx') {
      const excelBuffer = await this.partnersService.convertToExcel(prestataires);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="prestataires-${token.substring(0, 8)}.xlsx"`);
      return res.send(excelBuffer);
    }
    
    // Format JSON par défaut
    return res.json({
      success: true,
      count: prestataires.length,
      data: prestataires,
      format: 'json',
      // Informations sur les formats disponibles
      formats: {
        json: 'Les données sont déjà au format JSON',
        csv: 'Ajoutez ?format=csv à l\'URL pour obtenir un CSV',
        excel: 'Ajoutez ?format=excel à l\'URL pour obtenir un Excel',
      },
    });
  }
}

