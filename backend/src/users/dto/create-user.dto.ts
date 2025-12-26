import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { GeographicScope } from '../../common/enums/geographic-scope.enum';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ enum: GeographicScope })
  @IsEnum(GeographicScope)
  scope: GeographicScope;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  provinceId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  zoneId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  aireId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  partnerId?: string;
}

