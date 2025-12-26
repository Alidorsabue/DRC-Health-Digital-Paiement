import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('national')
  @ApiOperation({ summary: 'Statistiques nationales' })
  @ApiQuery({ name: 'campaignId', required: false, description: 'ID de la campagne' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire' })
  getNationalStats(
    @Query('campaignId') campaignId?: string,
    @Query('formId') formId?: string,
  ) {
    return this.statsService.getNationalStats({ campaignId, formId });
  }

  @Get('province/:id')
  @ApiOperation({ summary: 'Statistiques d\'une province' })
  @ApiQuery({ name: 'campaignId', required: false, description: 'ID de la campagne' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire' })
  getProvinceStats(
    @Param('id') id: string,
    @Query('campaignId') campaignId?: string,
    @Query('formId') formId?: string,
  ) {
    return this.statsService.getProvinceStats(id, { campaignId, formId });
  }

  @Get('zone/:id')
  @ApiOperation({ summary: 'Statistiques d\'une zone' })
  @ApiQuery({ name: 'campaignId', required: false, description: 'ID de la campagne' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire' })
  getZoneStats(
    @Param('id') id: string,
    @Query('campaignId') campaignId?: string,
    @Query('formId') formId?: string,
  ) {
    return this.statsService.getZoneStats(id, { campaignId, formId });
  }

  @Get('aire/:id')
  @ApiOperation({ summary: 'Statistiques d\'une aire' })
  @ApiQuery({ name: 'campaignId', required: false, description: 'ID de la campagne' })
  @ApiQuery({ name: 'formId', required: false, description: 'ID du formulaire' })
  getAireStats(
    @Param('id') id: string,
    @Query('campaignId') campaignId?: string,
    @Query('formId') formId?: string,
  ) {
    return this.statsService.getAireStats(id, { campaignId, formId });
  }

  @Get('provinces-from-data')
  @ApiOperation({ summary: 'Récupère les provinces uniques depuis toutes les tables form_*' })
  getProvincesFromData() {
    return this.statsService.getProvincesFromData();
  }

  @Get('zones-from-data/:provinceId')
  @ApiOperation({ summary: 'Récupère les zones uniques depuis toutes les tables form_* pour une province' })
  getZonesFromData(@Param('provinceId') provinceId: string) {
    return this.statsService.getZonesFromData(provinceId);
  }

  @Get('aires-from-data/:zoneId')
  @ApiOperation({ summary: 'Récupère les aires uniques depuis toutes les tables form_* pour une zone' })
  getAiresFromData(@Param('zoneId') zoneId: string) {
    return this.statsService.getAiresFromData(zoneId);
  }
}

