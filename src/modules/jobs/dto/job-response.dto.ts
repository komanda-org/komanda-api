import { ContractType, JobStatus } from '@prisma/client';

export interface JobRestaurantDto {
  restaurantName: string;
  logoUrl: string | null;
}

export interface JobResponseDto {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  salary: string | null;
  contractType: ContractType;
  status: JobStatus;
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
