import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { XlsFormParserService } from './xlsform-parser.service';
import { CreateFormDto } from './dto/create-form.dto';
import { CreateFormVersionDto } from './dto/create-form-version.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Forms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('forms')
export class FormsController {
  constructor(
    private readonly formsService: FormsService,
    private readonly xlsFormParserService: XlsFormParserService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Créer un formulaire (SuperAdmin uniquement)' })
  create(@Body() createFormDto: CreateFormDto, @CurrentUser() user: any) {
    return this.formsService.create(createFormDto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Liste tous les formulaires' })
  findAll() {
    return this.formsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un formulaire par ID' })
  async findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Patch(':id/update-xlsform')
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mettre à jour un formulaire depuis un fichier XlsForm' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier XlsForm (.xlsx ou .xls)',
        },
      },
    },
  })
  async updateXlsForm(
    @Param('id') formId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    // Vérifier que c'est un fichier Excel
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        'Le fichier doit être un fichier Excel (.xlsx ou .xls)',
      );
    }

    try {
      // Vérifier que le formulaire existe
      const form = await this.formsService.findOne(formId);
      if (!form) {
        throw new NotFoundException('Formulaire non trouvé');
      }

      // Parser le nouveau fichier XlsForm
      const { schema } =
        await this.xlsFormParserService.parseXlsForm(file.buffer);

      // Ne pas mettre à jour le nom et la description du formulaire, ils restent inchangés

      // Créer une nouvelle version avec le nouveau schéma
      const createVersionDto: CreateFormVersionDto = {
        schema,
        isPublished: false,
      };

      const newVersion = await this.formsService.createVersion(formId, createVersionDto);

      return {
        success: true,
        message: 'Formulaire mis à jour avec succès',
        form: {
          id: form.id,
          name: form.name,
          description: form.description,
        },
        version: {
          version: newVersion.version,
          isPublished: newVersion.isPublished,
        },
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour XlsForm:', error);
      throw new BadRequestException(
        `Erreur lors de la mise à jour: ${error.message}`,
      );
    }
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Mettre à jour un formulaire (SuperAdmin uniquement)' })
  async update(@Param('id') id: string, @Body() updateFormDto: UpdateFormDto) {
    return this.formsService.update(id, updateFormDto);
  }

  @Get(':id/enregistrement-fields')
  @ApiOperation({ summary: 'Récupérer les champs d\'un formulaire d\'enregistrement pour le mapping' })
  async getEnregistrementFields(@Param('id') id: string) {
    return this.formsService.getEnregistrementFormFields(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Supprimer un formulaire (SuperAdmin uniquement)' })
  async remove(@Param('id') id: string) {
    await this.formsService.remove(id);
    return { message: 'Formulaire supprimé avec succès' };
  }

  @Post(':id/versions')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Créer une nouvelle version du formulaire' })
  createVersion(
    @Param('id') id: string,
    @Body() createVersionDto: CreateFormVersionDto,
  ) {
    return this.formsService.createVersion(id, createVersionDto);
  }

  @Patch(':id/versions/:version/publish')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Publier une version du formulaire' })
  async publishVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.formsService.publishVersion(id, version);
  }

  @Patch(':id/versions/:version/send')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Envoyer un formulaire publié aux applications mobiles' })
  async sendToMobile(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const result = await this.formsService.sendToMobile(id, version);
    return {
      ...result,
      message: 'Formulaire envoyé aux applications mobiles avec succès',
    };
  }

  @Patch(':id/versions/:version/retract')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Retirer un formulaire des applications mobiles' })
  async retractFromMobile(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    const result = await this.formsService.retractFromMobile(id, version);
    return {
      ...result,
      message: 'Formulaire retiré des applications mobiles avec succès',
    };
  }

  @Get(':id/prestataires/count')
  @ApiOperation({ summary: 'Compter le nombre de prestataires pour un formulaire' })
  async countPrestataires(@Param('id') id: string) {
    const count = await this.formsService.countPrestatairesByForm(id);
    return { count };
  }

  @Get(':id/submissions/data')
  @ApiOperation({ summary: 'Récupérer les données des soumissions pour un formulaire (table dynamique)' })
  async getFormSubmissionsData(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return this.formsService.getFormSubmissionsData(id, pageNum, limitNum);
  }

  @Get(':id/prestataires/data')
  @ApiOperation({ summary: 'Récupérer les données des prestataires pour un formulaire (ancienne méthode - pour compatibilité)' })
  async getPrestatairesData(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('includeValidations') includeValidations?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: any,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 30;
    const includeValidationsBool = includeValidations === 'true' || includeValidations === '1';
    const filters: Record<string, any> = { includeValidations: includeValidationsBool };
    if (status) {
      filters.status = status;
    }
    return this.formsService.getPrestatairesDataByForm(id, pageNum, limitNum, filters, user);
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Obtenir les statistiques descriptives d\'un formulaire' })
  async getStatistics(@Param('id') id: string) {
    return this.formsService.getFormStatistics(id);
  }

  @Post('import-xlsform')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Importer un formulaire depuis un fichier XlsForm (SuperAdmin uniquement)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        type: {
          type: 'string',
          enum: ['enregistrement', 'validation'],
          default: 'enregistrement',
        },
        title: {
          type: 'string',
          description: 'Titre du formulaire (optionnel, sera extrait du fichier si non fourni)',
        },
      },
    },
  })
  async importXlsForm(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string = 'enregistrement',
    @Body('title') title: string | undefined,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    // Vérifier que c'est un fichier Excel
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        'Le fichier doit être un fichier Excel (.xlsx ou .xls)',
      );
    }

    try {
      // Parser le fichier XlsForm
      const { schema, formName, formDescription } =
        await this.xlsFormParserService.parseXlsForm(file.buffer);

      // Utiliser le titre fourni s'il est présent, sinon utiliser celui du fichier
      const finalFormName = title && title.trim() ? title.trim() : formName;

      // Créer le formulaire
      const createFormDto: CreateFormDto = {
        name: finalFormName,
        description: formDescription,
        type: (type as 'enregistrement' | 'validation') || 'enregistrement',
      };

      const form = await this.formsService.create(createFormDto, user.userId);

      // Créer la première version avec le schéma importé
      const createVersionDto: CreateFormVersionDto = {
        schema,
        isPublished: false,
      };

      await this.formsService.createVersion(form.id, createVersionDto);

      return {
        success: true,
        message: 'Formulaire importé avec succès',
        form: {
          id: form.id,
          name: form.name,
          description: form.description,
        },
      };
    } catch (error) {
      console.error('Erreur lors de l\'import XlsForm:', error);
      throw new BadRequestException(
        `Erreur lors de l'import: ${error.message}`,
      );
    }
  }
}

