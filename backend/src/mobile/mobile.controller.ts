import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MobileService } from './mobile.service';
import { SyncDto } from './dto/sync.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Mobile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.IT)
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Post('sync')
  @ApiOperation({ summary: 'Synchronisation bidirectionnelle (IT uniquement)' })
  sync(@Body() syncDto: SyncDto, @CurrentUser() user: any) {
    return this.mobileService.sync(syncDto, user.userId, user.aireId);
  }

  @Get('prestataires/validation')
  @ApiOperation({ summary: 'Obtenir la liste des prestataires à valider' })
  getPrestatairesForValidation(
    @Query('campaignId') campaignId: string,
    @CurrentUser() user: any,
  ) {
    return this.mobileService.getPrestatairesForValidation(
      campaignId,
      user.aireId,
    );
  }
}

