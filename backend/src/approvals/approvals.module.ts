import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalMCZ } from './entities/approval-mcz.entity';
import { PrestatairesModule } from '../prestataires/prestataires.module';
import { UsersModule } from '../users/users.module';
import { FormsModule } from '../forms/forms.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApprovalMCZ]),
    PrestatairesModule,
    UsersModule,
    forwardRef(() => FormsModule),
    CampaignsModule,
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}

