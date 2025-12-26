import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrestatairesService } from './prestataires.service';
import { CreatePrestataireDto } from './dto/create-prestataire.dto';
import { ValidatePrestataireDto } from './dto/validate-prestataire.dto';
import { UpdatePrestataireDto } from './dto/update-prestataire.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GeographicScope } from '../common/enums/geographic-scope.enum';
import { PrestataireStatus } from '../common/enums/status.enum';

@ApiTags('Prestataires')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prestataires')
export class PrestatairesController {
  constructor(private readonly prestatairesService: PrestatairesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.IT)
  @ApiOperation({ summary: 'Enregistrer un prestataire (IT uniquement)' })
  create(
    @Body() createPrestataireDto: CreatePrestataireDto,
    @CurrentUser() user: any,
  ) {
    return this.prestatairesService.create(
      createPrestataireDto,
      user.userId,
      user.scope,
      user.aireId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Liste des prestataires avec filtres' })
  @ApiQuery({ name: 'campaignId', required: false })
  @ApiQuery({ name: 'provinceId', required: false })
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'aireId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PrestataireStatus })
  findAll(
    @Query('campaignId') campaignId?: string,
    @Query('provinceId') provinceId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('aireId') aireId?: string,
    @Query('status') status?: PrestataireStatus,
    @CurrentUser() user?: any,
  ) {
    const filters: any = {};
    
    console.log('[PrestatairesController.findAll] User:', {
      role: user?.role,
      scope: user?.scope,
      provinceId: user?.provinceId,
      zoneId: user?.zoneId,
      aireId: user?.aireId,
    });
    console.log('[PrestatairesController.findAll] Query params:', {
      campaignId,
      provinceId,
      zoneId,
      aireId,
      status,
    });
    
    if (campaignId) filters.campaignId = campaignId;
    if (user.scope === GeographicScope.AIRE) {
      filters.aireId = user.aireId;
    } else if (user.scope === GeographicScope.ZONE) {
      filters.zoneId = user.zoneId;
    } else if (user.scope === GeographicScope.PROVINCE) {
      filters.provinceId = user.provinceId;
    }
    // Pour DPS, utiliser le provinceId de la query si fourni, sinon celui de l'utilisateur
    if (provinceId && user.scope !== GeographicScope.AIRE) {
      filters.provinceId = provinceId;
    }
    if (zoneId && user.scope !== GeographicScope.AIRE) filters.zoneId = zoneId;
    if (aireId && user.scope !== GeographicScope.AIRE) filters.aireId = aireId;
    if (status) filters.status = status;

    console.log('[PrestatairesController.findAll] Filters appliqués:', filters);

    return this.prestatairesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un prestataire par ID' })
  findOne(@Param('id') id: string) {
    return this.prestatairesService.findOne(id);
  }

  @Get('pending/validation')
  @UseGuards(RolesGuard)
  @Roles(Role.IT)
  @ApiOperation({ summary: 'Récupérer les prestataires en attente de validation depuis la table du formulaire' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire d\'enregistrement (optionnel)' })
  findPendingValidation(
    @Query('formId') formId?: string,
    @CurrentUser() user?: any,
  ) {
    return this.prestatairesService.findPendingValidation(formId, user);
  }

  @Patch(':id/validate')
  @UseGuards(RolesGuard)
  @Roles(Role.IT)
  @ApiOperation({ summary: 'Valider un prestataire avec le nombre de jours de présence, la date de validation et la campagne' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire (optionnel, récupéré depuis campaignId si non fourni)' })
  validatePrestataire(
    @Param('id') id: string,
    @Body() validateDto: ValidatePrestataireDto,
    @Query('formId') formId?: string,
  ) {
    return this.prestatairesService.validatePrestataire(
      id, 
      validateDto.presenceDays,
      validateDto.validationDate,
      validateDto.campaignId,
      formId,
    );
  }

  @Patch(':id/invalidate')
  @UseGuards(RolesGuard)
  @Roles(Role.IT)
  @ApiOperation({ summary: 'Invalider un prestataire (remettre le status à ENREGISTRE)' })
  @ApiQuery({ name: 'formId', required: true, description: 'ID du formulaire' })
  invalidatePrestataire(
    @Param('id') id: string,
    @Query('formId') formId: string,
  ) {
    return this.prestatairesService.invalidatePrestataire(id, formId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.IT)
  @ApiOperation({ summary: 'Mettre à jour les informations d\'un prestataire' })
  @ApiQuery({ name: 'formId', required: true, description: 'ID du formulaire' })
  updatePrestataire(
    @Param('id') id: string,
    @Body() updateDto: UpdatePrestataireDto,
    @Query('formId') formId: string,
  ) {
    return this.prestatairesService.updatePrestataire(id, updateDto, formId);
  }

  @Get(':id/validations')
  @UseGuards(RolesGuard)
  @Roles(Role.IT)
  @ApiOperation({ summary: 'Récupérer toutes les validations d\'un prestataire (historique des campagnes)' })
  getPrestataireValidations(@Param('id') id: string) {
    return this.prestatairesService.getPrestataireValidations(id);
  }
}

