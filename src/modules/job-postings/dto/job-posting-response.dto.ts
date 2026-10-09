import { ContractType, JobStatus } from '@prisma/client';

export interface JobPostingResponseDto {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  salary?: number;
  contractType: ContractType;
  shift?: string;
  status: JobStatus;
  restaurantId: string;
  createdAt: Date;
}
