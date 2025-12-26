import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Prestataire } from '../../prestataires/entities/prestataire.entity';

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('approvals_mcz')
export class ApprovalMCZ {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prestataire)
  @JoinColumn({ name: 'prestataire_id' })
  prestataire: Prestataire;

  @Column()
  prestataireId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'mcz_id' })
  mcz: User;

  @Column()
  mczId: string;

  @Column({
    type: 'enum',
    enum: ApprovalDecision,
  })
  decision: ApprovalDecision;

  @Column({ type: 'text', nullable: true })
  commentaire: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

