import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { PrestatairesModule } from '../prestataires/prestataires.module';
import { PaymentsModule } from '../payments/payments.module';
import { FormsModule } from '../forms/forms.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [PrestatairesModule, PaymentsModule, FormsModule, CampaignsModule],
  controllers: [PartnersController],
  providers: [PartnersService],
})
export class PartnersModule {}

