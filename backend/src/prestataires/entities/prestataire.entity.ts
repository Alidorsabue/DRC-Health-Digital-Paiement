import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Campaign } from '../../campaigns/entities/campaign.entity';
import { PrestataireStatus } from '../../common/enums/status.enum';
import { ValidationIT } from '../../validations/entities/validation-it.entity';

@Entity('prestataires')
@Index(['campaignId', 'aireId'])
@Index(['campaignId', 'zoneId'])
@Index(['campaignId', 'provinceId'])
@Index(['id'], { unique: true })
export class Prestataire {
  @PrimaryColumn({ type: 'varchar', length: 20, nullable: false })
  id: string;

  @Column()
  nom: string;

  @Column()
  prenom: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true })
  categorie: string;

  @Column({ nullable: true })
  provinceId: string;

  @Column({ nullable: true })
  zoneId: string;

  @Column({ nullable: true })
  aireId: string;

  @Column({
    type: 'enum',
    enum: PrestataireStatus,
    default: PrestataireStatus.ENREGISTRE,
  })
  status: PrestataireStatus;

  @Column({ type: 'integer', nullable: true })
  presenceDays: number;

  @Column({ type: 'jsonb', nullable: true })
  enregistrementData: Record<string, any>;

  @ManyToOne(() => Campaign, { nullable: true })
  @JoinColumn({ name: 'campaign_id' })
  campaign: Campaign;

  @Column({ nullable: true })
  campaignId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'enregistre_par' })
  enregistrePar: User;

  @Column()
  enregistreParId: string;

  @OneToOne(() => ValidationIT, (validation) => validation.prestataire, {
    cascade: true,
  })
  validation: ValidationIT;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

