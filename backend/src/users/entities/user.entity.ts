import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { GeographicScope } from '../../common/enums/geographic-scope.enum';
import { Prestataire } from '../../prestataires/entities/prestataire.entity';
import { ValidationIT } from '../../validations/entities/validation-it.entity';
import { ApprovalMCZ } from '../../approvals/entities/approval-mcz.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  email: string;

  @Column()
  fullName: string;

  @Column({
    type: 'enum',
    enum: Role,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: GeographicScope,
  })
  scope: GeographicScope;

  @Column({ nullable: true })
  provinceId: string;

  @Column({ nullable: true })
  zoneId: string;

  @Column({ nullable: true })
  aireId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  partnerId: string;

  @OneToMany(() => Prestataire, (prestataire) => prestataire.enregistrePar)
  prestatairesEnregistres: Prestataire[];

  @OneToMany(() => ValidationIT, (validation) => validation.it)
  validations: ValidationIT[];

  @OneToMany(() => ApprovalMCZ, (approval) => approval.mcz)
  approvals: ApprovalMCZ[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

