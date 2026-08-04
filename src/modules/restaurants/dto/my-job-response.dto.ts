import { ContractType, JobStatus } from '@prisma/client';

export interface MyJobDto {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string | null;
  salario: string | null;
  tipoContrato: ContractType;
  status: JobStatus;
  createdAt: Date;
}

export interface ListMyJobsResponseDto {
  data: MyJobDto[];
  total: number;
  skip: number;
  take: number;
}
