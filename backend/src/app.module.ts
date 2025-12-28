import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FormsModule } from './forms/forms.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PrestatairesModule } from './prestataires/prestataires.module';
import { ValidationsModule } from './validations/validations.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { PaymentsModule } from './payments/payments.module';
import { PartnersModule } from './partners/partners.module';
import { StatsModule } from './stats/stats.module';
import { GeographicModule } from './geographic/geographic.module';
import { MobileModule } from './mobile/mobile.module';
import { SharedDataModule } from './shared/shared-data.module';
import { DatabaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthModule,
    UsersModule,
    FormsModule,
    CampaignsModule,
    PrestatairesModule,
    ValidationsModule,
    ApprovalsModule,
    PaymentsModule,
    PartnersModule,
    StatsModule,
    GeographicModule,
    MobileModule,
    SharedDataModule,
  ],
})
export class AppModule {}

