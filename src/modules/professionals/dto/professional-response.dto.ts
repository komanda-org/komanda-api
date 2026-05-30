import { Role } from '@prisma/client';

export interface ProfessionalResponseDto {
  userId: string;
  email: string;
  role: Role;
  fullName: string;
  mainRole: string;
  createdAt: Date;
}
