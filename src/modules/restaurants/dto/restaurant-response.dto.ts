import { Role } from '@prisma/client';

export interface RestaurantResponseDto {
  userId: string;
  email: string;
  role: Role;
  restaurantName: string;
  cnpj: string;
  tradeName: string;
  phone: string;
  cuisineType: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  cnpj: string;
  zipCode: string;
  createdAt: Date;
}
