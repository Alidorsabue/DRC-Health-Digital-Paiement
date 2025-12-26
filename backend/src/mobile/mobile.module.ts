import { Module } from '@nestjs/common';
import { MobileService } from './mobile.service';
import { MobileController } from './mobile.controller';
import { PrestatairesModule } from '../prestataires/prestataires.module';
import { ValidationsModule } from '../validations/validations.module';
import { FormsModule } from '../forms/forms.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    PrestatairesModule,
    ValidationsModule,
    FormsModule,
    CampaignsModule,
  ],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}

