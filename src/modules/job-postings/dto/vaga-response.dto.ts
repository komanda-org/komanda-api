import { ContractType, JobStatus } from '@prisma/client';

export interface VagaResponseDto {
  id: string;
  titulo: string;
  descricao: string;
  requisitos?: string;
  salario?: number;
  tipoContrato: ContractType;
  status: JobStatus;
  restauranteId: string;
  createdAt: Date;
}
