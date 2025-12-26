import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prestataire } from '../prestataires/entities/prestataire.entity';

@Injectable()
export class GeographicService {
  constructor(
    @InjectRepository(Prestataire)
    private prestatairesRepository: Repository<Prestataire>,
  ) {}

  async getProvinces(): Promise<{ id: string; name: string }[]> {
    const provinces = await this.prestatairesRepository
      .createQueryBuilder('prestataire')
      .select('prestataire.provinceId', 'id')
      .addSelect('prestataire.provinceId', 'name')
      .distinct(true)
      .orderBy('prestataire.provinceId', 'ASC')
      .getRawMany();

    return provinces.map((p) => ({ id: p.id, name: p.name }));
  }

  async getZones(provinceId: string): Promise<{ id: string; name: string }[]> {
    const zones = await this.prestatairesRepository
      .createQueryBuilder('prestataire')
      .select('prestataire.zoneId', 'id')
      .addSelect('prestataire.zoneId', 'name')
      .distinct(true)
      .where('prestataire.provinceId = :provinceId', { provinceId })
      .orderBy('prestataire.zoneId', 'ASC')
      .getRawMany();

    return zones.map((z) => ({ id: z.id, name: z.name }));
  }

  async getAires(zoneId: string): Promise<{ id: string; name: string }[]> {
    const aires = await this.prestatairesRepository
      .createQueryBuilder('prestataire')
      .select('prestataire.aireId', 'id')
      .addSelect('prestataire.aireId', 'name')
      .distinct(true)
      .where('prestataire.zoneId = :zoneId', { zoneId })
      .orderBy('prestataire.aireId', 'ASC')
      .getRawMany();

    return aires.map((a) => ({ id: a.id, name: a.name }));
  }
}

