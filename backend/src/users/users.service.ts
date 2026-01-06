import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createFirstSuperAdmin(createUserDto: CreateUserDto): Promise<User> {
    // Vérifier s'il existe déjà un SuperAdmin
    const existingSuperAdmin = await this.usersRepository.findOne({
      where: { role: Role.SUPERADMIN },
    });

    if (existingSuperAdmin) {
      throw new ForbiddenException('Un SuperAdmin existe déjà. Utilisez l\'endpoint authentifié pour créer d\'autres utilisateurs.');
    }

    // Vérifier que le rôle est bien SUPERADMIN
    if (createUserDto.role !== Role.SUPERADMIN) {
      throw new BadRequestException('Cet endpoint ne peut créer que des SuperAdmin');
    }

    return this.create(createUserDto);
  }

  async create(createUserDto: CreateUserDto, requestingUserRole?: Role): Promise<User> {
    // Si l'utilisateur est Admin, vérifier qu'il ne peut créer que IT, MCZ, DPS
    if (requestingUserRole === Role.ADMIN) {
      const allowedRoles = [Role.IT, Role.MCZ, Role.DPS];
      if (!allowedRoles.includes(createUserDto.role)) {
        throw new ForbiddenException('Vous ne pouvez créer que des utilisateurs IT, MCZ ou DPS');
      }
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });
    return this.usersRepository.save(user);
  }

  async findAll(requestingUserRole?: Role): Promise<User[]> {
    const query = this.usersRepository.createQueryBuilder('user')
      .select([
        'user.id',
        'user.username',
        'user.email',
        'user.telephone',
        'user.fullName',
        'user.role',
        'user.scope',
        'user.isActive',
        'user.createdAt',
        'user.password',
      ]);

    // Si l'utilisateur est Admin, filtrer pour exclure SUPERADMIN, ADMIN, PARTNER, NATIONAL
    if (requestingUserRole === Role.ADMIN) {
      query.where('user.role NOT IN (:...excludedRoles)', {
        excludedRoles: [Role.SUPERADMIN, Role.ADMIN, Role.PARTNER, Role.NATIONAL],
      });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }
    return user;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByTelephone(telephone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telephone } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    // Chercher d'abord par username
    let user = await this.findByUsername(identifier);
    if (user) return user;

    // Ensuite par téléphone
    user = await this.findByTelephone(identifier);
    if (user) return user;

    // Enfin par email
    user = await this.findByEmail(identifier);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, requestingUserRole?: Role): Promise<User> {
    const user = await this.findOne(id);
    
    // Si l'utilisateur est Admin, vérifier qu'il ne peut modifier que IT, MCZ, DPS
    if (requestingUserRole === Role.ADMIN) {
      const allowedRoles = [Role.IT, Role.MCZ, Role.DPS];
      if (!allowedRoles.includes(user.role)) {
        throw new ForbiddenException('Vous ne pouvez modifier que les utilisateurs IT, MCZ ou DPS');
      }
      // Empêcher le changement de rôle vers un rôle non autorisé
      if (updateUserDto.role && !allowedRoles.includes(updateUserDto.role)) {
        throw new ForbiddenException('Vous ne pouvez attribuer que les rôles IT, MCZ ou DPS');
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string, requestingUserRole?: Role): Promise<void> {
    const user = await this.findOne(id);
    
    // Si l'utilisateur est Admin, vérifier qu'il ne peut supprimer que IT, MCZ, DPS
    if (requestingUserRole === Role.ADMIN) {
      const allowedRoles = [Role.IT, Role.MCZ, Role.DPS];
      if (!allowedRoles.includes(user.role)) {
        throw new ForbiddenException('Vous ne pouvez supprimer que les utilisateurs IT, MCZ ou DPS');
      }
    }

    await this.usersRepository.remove(user);
  }
}

