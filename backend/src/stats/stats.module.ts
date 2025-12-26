import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';
import { PrestatairesModule } from '../prestataires/prestataires.module';
import { PaymentsModule } from '../payments/payments.module';
import { FormsModule } from '../forms/forms.module';
import { Payment } from '../payments/entities/payment.entity';

@Module({
  imports: [
    PrestatairesModule,
    PaymentsModule,
    FormsModule,
    TypeOrmModule.forFeature([Payment]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}

