import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidationsService } from './validations.service';
import { ValidationsController } from './validations.controller';
import { ValidationIT } from './entities/validation-it.entity';
import { PrestatairesModule } from '../prestataires/prestataires.module';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ValidationIT]),
    PrestatairesModule,
    UsersModule,
    CampaignsModule,
  ],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}

