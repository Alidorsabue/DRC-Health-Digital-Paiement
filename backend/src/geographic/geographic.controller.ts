import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GeographicService } from './geographic.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Geographic')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('geographic')
export class GeographicController {
  constructor(private readonly geographicService: GeographicService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Récupérer toutes les provinces' })
  getProvinces() {
    return this.geographicService.getProvinces();
  }

  @Get('zones')
  @ApiOperation({ summary: 'Récupérer les zones d\'une province' })
  @ApiQuery({ name: 'provinceId', required: true })
  getZones(@Query('provinceId') provinceId: string) {
    return this.geographicService.getZones(provinceId);
  }

  @Get('aires')
  @ApiOperation({ summary: 'Récupérer les aires d\'une zone' })
  @ApiQuery({ name: 'zoneId', required: true })
  getAires(@Query('zoneId') zoneId: string) {
    return this.geographicService.getAires(zoneId);
  }
}

