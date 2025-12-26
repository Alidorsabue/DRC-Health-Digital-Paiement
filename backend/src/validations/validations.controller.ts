import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Get,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ValidationsService } from './validations.service';
import { CreateValidationDto } from './dto/create-validation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Validations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.IT)
@Controller('prestataires/:prestataireId/validation-it')
export class ValidationsController {
  constructor(private readonly validationsService: ValidationsService) {}

  @Post()
  @ApiOperation({ summary: 'Valider un prestataire (IT uniquement)' })
  create(
    @Param('prestataireId') prestataireId: string,
    @Body() createValidationDto: CreateValidationDto,
    @CurrentUser() user: any,
  ) {
    return this.validationsService.create(
      prestataireId,
      createValidationDto,
      user.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Obtenir la validation d\'un prestataire' })
  findByPrestataire(@Param('prestataireId') prestataireId: string) {
    return this.validationsService.findByPrestataire(prestataireId);
  }
}

