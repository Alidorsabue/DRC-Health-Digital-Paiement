import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    // Chercher l'utilisateur par username, téléphone ou email
    const user = await this.usersService.findByIdentifier(identifier);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: User) {
    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
      scope: user.scope,
      provinceId: user.provinceId,
      zoneId: user.zoneId,
      aireId: user.aireId,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        telephone: user.telephone,
        fullName: user.fullName,
        role: user.role,
        scope: user.scope,
        provinceId: user.provinceId,
        zoneId: user.zoneId,
        aireId: user.aireId,
      },
    };
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Token invalide');
    }
  }
}

