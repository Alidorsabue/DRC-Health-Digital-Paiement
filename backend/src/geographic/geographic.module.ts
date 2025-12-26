import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeographicController } from './geographic.controller';
import { GeographicService } from './geographic.service';
import { Prestataire } from '../prestataires/entities/prestataire.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Prestataire])],
  controllers: [GeographicController],
  providers: [GeographicService],
})
export class GeographicModule {}







