import { Role } from '@prisma/client';

export interface RestaurantResponseDto {
  userId: string;
  email: string;
  role: Role;
  restaurantName: string;
  cnpj: string;
  phone: string;
  cuisineType: string;
  description: string;
  address: string;
  zipCode: string | null;
  logoUrl?: string;
  createdAt: Date;
}
