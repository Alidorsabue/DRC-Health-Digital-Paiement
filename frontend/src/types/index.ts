export enum Role {
  IT = 'IT',
  MCZ = 'MCZ',
  DPS = 'DPS',
  NATIONAL = 'NATIONAL',
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  PARTNER = 'PARTNER',
}

export enum GeographicScope {
  AIRE = 'AIRE',
  ZONE = 'ZONE',
  PROVINCE = 'PROVINCE',
  NATIONAL = 'NATIONAL',
}

export enum PrestataireStatus {
  ENREGISTRE = 'ENREGISTRE',
  VALIDE_PAR_IT = 'VALIDE_PAR_IT',
  APPROUVE_PAR_MCZ = 'APPROUVE_PAR_MCZ',
  REJETE_PAR_MCZ = 'REJETE_PAR_MCZ',
}

export interface User {
  id: string;
  username: string;
  email?: string;
  telephone: string;
  fullName: string;
  role: Role;
  scope: GeographicScope;
  provinceId?: string;
  zoneId?: string;
  aireId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  type: string;
  linkedEnregistrementFormId?: string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  versions?: FormVersion[];
  createdBy?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
}

export interface FormVersion {
  id: string;
  formId: string;
  version: number;
  schema: Record<string, any>;
  isPublished: boolean;
  isSentToMobile: boolean;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  isActive: boolean;
  enregistrementFormId?: string;
  validationFormId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  email?: string;
  telephone: string;
  fullName: string;
  role: Role;
  scope: GeographicScope;
  provinceId?: string;
  zoneId?: string;
  aireId?: string;
  partnerId?: string;
}

export interface CreateFormDto {
  name: string;
  description?: string;
  type: string;
}

export interface CreateFormVersionDto {
  schema: Record<string, any>;
  isPublished?: boolean;
}

export interface CreateCampaignDto {
  name: string;
  description?: string;
  type: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  enregistrementFormId?: string;
  validationFormId?: string;
}

