import { Role } from '@prisma/client';

export interface RestaurantResponseDto {
  userId: string;
  email: string;
  role: Role;
  tradeName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  cnpj: string;
  zipCode: string;
  createdAt: Date;
}
