import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormsService } from './forms.service';
import { FormsController } from './forms.controller';
import { FormsPublicController } from './forms-public.controller';
import { DynamicTableService } from './dynamic-table.service';
import { XlsFormParserService } from './xlsform-parser.service';
import { Form } from './entities/form.entity';
import { FormVersion } from './entities/form-version.entity';
import { UsersModule } from '../users/users.module';
import { PrestatairesModule } from '../prestataires/prestataires.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Form, FormVersion]),
    UsersModule,
    forwardRef(() => PrestatairesModule),
    forwardRef(() => CampaignsModule),
  ],
  controllers: [FormsController, FormsPublicController],
  providers: [FormsService, DynamicTableService, XlsFormParserService],
  exports: [FormsService, DynamicTableService, XlsFormParserService],
})
export class FormsModule {}

