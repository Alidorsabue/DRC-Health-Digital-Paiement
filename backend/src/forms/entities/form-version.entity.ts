import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Form } from './form.entity';

@Entity('form_versions')
@Index(['formId', 'version'], { unique: true })
export class FormVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Form, (form) => form.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form: Form;

  @Column()
  formId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'jsonb' })
  schema: Record<string, any>;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  isSentToMobile: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

