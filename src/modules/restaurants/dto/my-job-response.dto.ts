import { ContractType, JobStatus, JobShift } from '@prisma/client';

export interface MyJobDto {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  salary: number | null;
  contractType: ContractType;
  shifts: JobShift[];
  status: JobStatus;
  urgent: boolean;
  createdAt: Date;
}

export interface ListMyJobsResponseDto {
  data: MyJobDto[];
  total: number;
  skip: number;
  take: number;
}
