import { Role } from '@prisma/client';

export interface RestaurantResponseDto {
  userId: string;
  email: string;
  role: Role;
  restaurantName: string;
  cnpj: string;
  address: string;
  phone: string;
  zipCode: string;
  logoUrl?: string;
  createdAt: Date;
}
