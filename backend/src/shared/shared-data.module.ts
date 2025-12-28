import { Module } from '@nestjs/common';
import { SharedDataController } from './shared-data.controller';

@Module({
  controllers: [SharedDataController],
})
export class SharedDataModule {}

