import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { BatchApprovalDto } from './dto/batch-approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrestataireStatus } from '../common/enums/status.enum';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MCZ, Role.IT)
@Controller('approbations')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des approbations depuis la table du formulaire (MCZ et IT)' })
  @ApiQuery({ name: 'formId', required: true, description: 'ID du formulaire d\'enregistrement' })
  @ApiQuery({ name: 'zoneId', required: false, description: 'ID de la zone (pour MCZ)' })
  @ApiQuery({ name: 'aireId', required: false, description: 'ID de l\'aire (pour IT)' })
  @ApiQuery({ name: 'status', required: false, enum: PrestataireStatus })
  findAll(
    @Query('formId') formId: string,
    @Query('zoneId') zoneId?: string,
    @Query('aireId') aireId?: string,
    @Query('status') status?: PrestataireStatus,
    @CurrentUser() user?: any,
  ) {
    // Pour MCZ, utiliser zoneId
    // Pour IT, utiliser aireId
    const targetZoneId = zoneId || (user?.role === 'MCZ' ? user?.zoneId : undefined);
    const targetAireId = aireId || (user?.role === 'IT' ? user?.aireId : undefined);
    return this.approvalsService.findByZoneOrAire(formId, targetZoneId, targetAireId, status);
  }

  @Post('prestataires/:prestataireId/approve')
  @ApiOperation({ summary: 'Approuver un prestataire' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire (optionnel, récupéré automatiquement si non fourni)' })
  approve(
    @Param('prestataireId') prestataireId: string,
    @Body() createApprovalDto: CreateApprovalDto,
    @CurrentUser() user: any,
    @Query('formId') formId?: string,
  ) {
    return this.approvalsService.create(prestataireId, createApprovalDto, user.userId, formId);
  }

  @Post('prestataires/:prestataireId/reject')
  @ApiOperation({ summary: 'Rejeter un prestataire' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire (optionnel, récupéré automatiquement si non fourni)' })
  reject(
    @Param('prestataireId') prestataireId: string,
    @Body() createApprovalDto: CreateApprovalDto,
    @CurrentUser() user: any,
    @Query('formId') formId?: string,
  ) {
    return this.approvalsService.create(prestataireId, createApprovalDto, user.userId, formId);
  }

  @Post('batch/approve')
  @ApiOperation({ summary: 'Approuver plusieurs prestataires en batch' })
  approveBatch(
    @Body() batchApprovalDto: BatchApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.approvalsService.approveBatch(
      batchApprovalDto.prestataireIds,
      user.userId,
      batchApprovalDto.commentaire,
      batchApprovalDto.formId,
    );
  }

  @Post('batch/reject')
  @ApiOperation({ summary: 'Rejeter plusieurs prestataires en batch' })
  rejectBatch(
    @Body() batchApprovalDto: BatchApprovalDto,
    @CurrentUser() user: any,
  ) {
    return this.approvalsService.rejectBatch(
      batchApprovalDto.prestataireIds,
      user.userId,
      batchApprovalDto.commentaire,
      batchApprovalDto.formId,
    );
  }
}

