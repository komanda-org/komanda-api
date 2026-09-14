import { ContractType, JobStatus } from '@prisma/client';

export interface MyJobDto {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  salary: number | null;
  contractType: ContractType;
  status: JobStatus;
  createdAt: Date;
}

export interface ListMyJobsResponseDto {
  data: MyJobDto[];
  total: number;
  skip: number;
  take: number;
}
