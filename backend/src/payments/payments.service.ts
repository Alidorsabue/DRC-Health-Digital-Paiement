import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentStatus } from '../common/enums/status.enum';
import { PrestatairesService } from '../prestataires/prestataires.service';
import { DynamicTableService } from '../forms/dynamic-table.service';
import { CampaignsService } from '../campaigns/campaigns.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    private prestatairesService: PrestatairesService,
    private dynamicTableService: DynamicTableService,
    private campaignsService: CampaignsService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    const prestataire = await this.prestatairesService.findOne(
      createPaymentDto.prestataireId,
    );

    const payment = this.paymentsRepository.create({
      ...createPaymentDto,
      status: PaymentStatus.PENDING,
    });
    return this.paymentsRepository.save(payment);
  }

  async findByBatch(batchId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { batchId },
      relations: ['prestataire'],
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    transactionId?: string,
    paymentReference?: string,
    formId?: string,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Paiement avec l'ID ${paymentId} non trouvé`);
    }

    payment.status = status;
    if (transactionId) payment.transactionId = transactionId;
    if (paymentReference) payment.paymentReference = paymentReference;
    if (status === PaymentStatus.PAID) {
      payment.paidAt = new Date();
    }

    const savedPayment = await this.paymentsRepository.save(payment);

    // Mettre à jour directement dans la table du formulaire
    try {
      // Récupérer le formId si non fourni
      let targetFormId = formId;
      if (!targetFormId) {
        // Essayer de trouver le formId depuis toutes les campagnes
        const allCampaigns = await this.campaignsService.findAll();
        for (const campaign of allCampaigns) {
          if (campaign.enregistrementFormId) {
            targetFormId = campaign.enregistrementFormId;
            break;
          }
        }
      }

      if (targetFormId && payment.amount) {
        // Récupérer le campaignId depuis l'enregistrement du prestataire
        const { data } = await this.dynamicTableService.getSubmissions(
          targetFormId,
          1,
          10, // Récupérer plusieurs pour trouver la dernière validation
          { prestataireId: payment.prestataireId },
        );

        let campaignId: string | undefined;
        if (data && data.length > 0) {
          // Trouver la dernière validation (avec validation_sequence le plus élevé) ou l'enregistrement original
          const prestataireRecord = data.find((r: any) => 
            r.validation_sequence != null && r.status === 'VALIDE_PAR_IT'
          ) || data.find((r: any) => r.validation_sequence == null);
          
          if (prestataireRecord) {
            campaignId = prestataireRecord.campaign_id || prestataireRecord.campaignId;
          }
        }

        await this.dynamicTableService.updatePaymentInTable(
          targetFormId,
          payment.prestataireId,
          status,
          payment.amount,
          payment.paidAt ? payment.paidAt.toISOString() : new Date().toISOString(),
          transactionId,
          campaignId, // Passer le campaignId pour trouver la bonne validation
        );
      }
    } catch (error) {
      // Log l'erreur mais ne pas faire échouer le paiement
      console.error(`Erreur lors de la mise à jour du paiement dans la table du formulaire:`, error);
    }

    return savedPayment;
  }

  async findByPrestataire(prestataireId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { prestataireId },
      order: { createdAt: 'DESC' },
    });
  }
}

