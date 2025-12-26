import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrestatairesService } from './prestataires.service';
import { PrestatairesController } from './prestataires.controller';
import { Prestataire } from './entities/prestataire.entity';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { FormsModule } from '../forms/forms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prestataire]),
    UsersModule,
    CampaignsModule,
    forwardRef(() => FormsModule),
  ],
  controllers: [PrestatairesController],
  providers: [PrestatairesService],
  exports: [PrestatairesService],
})
export class PrestatairesModule {}

