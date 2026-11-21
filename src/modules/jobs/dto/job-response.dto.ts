import { ContractType, JobStatus, JobShift } from '@prisma/client';

export interface JobRestaurantDto {
  restaurantName: string;
  logoUrl: string | null;
  cuisineType: string;
  averageRating: number | null;
  // Endereço comercial público; o front usa CEP + endereço para a distância.
  address: string;
  // null = restaurante itinerante (só eventos): o front não calcula distância.
  zipCode: string | null;
}

export interface JobResponseDto {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  salary: string | null;
  contractType: ContractType;
  shifts: JobShift[];
  status: JobStatus;
  urgent: boolean;
  restaurantId: string;
  restaurant: JobRestaurantDto;
  createdAt: Date;
}

export interface ListJobsResponseDto {
  data: JobResponseDto[];
  total: number;
  skip: number;
  take: number;
}
