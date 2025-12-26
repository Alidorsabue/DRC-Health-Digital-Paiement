import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Form } from '../../forms/entities/form.entity';
import { Prestataire } from '../../prestataires/entities/prestataire.entity';
import { User } from '../../users/entities/user.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  type: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Form, { nullable: true })
  @JoinColumn({ name: 'enregistrement_form_id' })
  enregistrementForm: Form;

  @Column({ nullable: true })
  enregistrementFormId: string;

  @ManyToOne(() => Form, { nullable: true })
  @JoinColumn({ name: 'validation_form_id' })
  validationForm: Form;

  @Column({ nullable: true })
  validationFormId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column()
  createdById: string;

  @OneToMany(() => Prestataire, (prestataire) => prestataire.campaign)
  prestataires: Prestataire[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

