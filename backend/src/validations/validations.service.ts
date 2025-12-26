import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationIT } from './entities/validation-it.entity';
import { CreateValidationDto } from './dto/create-validation.dto';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { PrestataireStatus } from '../common/enums/status.enum';
import { CampaignsService } from '../campaigns/campaigns.service';

@Injectable()
export class ValidationsService {
  constructor(
    @InjectRepository(ValidationIT)
    private validationsRepository: Repository<ValidationIT>,
    private prestatairesService: PrestatairesService,
    private campaignsService: CampaignsService,
  ) {}

  async create(
    prestataireId: string,
    createValidationDto: CreateValidationDto,
    userId: string,
  ): Promise<ValidationIT> {
    const prestataire = await this.prestatairesService.findOne(prestataireId);

    if (prestataire.status !== PrestataireStatus.ENREGISTRE) {
      throw new BadRequestException('Le prestataire a déjà été validé');
    }

    const campaign = await this.campaignsService.findOne(prestataire.campaignId);
    if (createValidationDto.joursPrestes > campaign.durationDays) {
      throw new BadRequestException(
        `Le nombre de jours prestés ne peut pas dépasser ${campaign.durationDays} jours`,
      );
    }

    if (!createValidationDto.signaturePrestataire) {
      throw new BadRequestException('La signature du prestataire est obligatoire');
    }

    const validation = this.validationsRepository.create({
      prestataireId,
      ...createValidationDto,
      itId: userId,
    });

    const savedValidation = await this.validationsRepository.save(validation);

    prestataire.status = PrestataireStatus.VALIDE_PAR_IT;
    await this.prestatairesService['prestatairesRepository'].save(prestataire);

    return savedValidation;
  }

  async findByPrestataire(prestataireId: string): Promise<ValidationIT | null> {
    return this.validationsRepository.findOne({
      where: { prestataireId },
      relations: ['prestataire', 'it'],
    });
  }

  async findByIT(itId: string): Promise<ValidationIT[]> {
    return this.validationsRepository.find({
      where: { itId },
      relations: ['prestataire'],
    });
  }
}

