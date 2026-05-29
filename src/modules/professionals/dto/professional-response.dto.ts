import { Role } from '@prisma/client';

export interface ProfessionalResponseDto {
  id: string;
  userId: string;
  email: string;
  role: Role;
  fullName: string;
  mainRole: string;
  createdAt: Date;
}
