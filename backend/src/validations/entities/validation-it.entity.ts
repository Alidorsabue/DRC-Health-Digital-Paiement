import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Prestataire } from '../../prestataires/entities/prestataire.entity';

@Entity('validations_it')
export class ValidationIT {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Prestataire, (prestataire) => prestataire.validation)
  @JoinColumn({ name: 'prestataire_id' })
  prestataire: Prestataire;

  @Column({ unique: true })
  prestataireId: string;

  @Column({ type: 'int' })
  joursPrestes: number;

  @Column({ type: 'text', nullable: true })
  preuvePresence: string;

  @Column({ type: 'text', nullable: true })
  signaturePrestataire: string;

  @Column({ type: 'jsonb', nullable: true })
  validationData: Record<string, any>;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'it_id' })
  it: User;

  @Column()
  itId: string;

  @Column({ type: 'text', nullable: true })
  commentaire: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

