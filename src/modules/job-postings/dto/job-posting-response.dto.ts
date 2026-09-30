import { ContractType, Job, JobStatus } from '@prisma/client';

export interface JobPostingResponseDto {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  salary?: number;
  contractType: ContractType;
  status: JobStatus;
  urgent: boolean;
  restaurantId: string;
  createdAt: Date;
}

// Monta a resposta só com campos públicos — updatedAt/deletedAt/active/closedAt
// do modelo Prisma não vazam para o consumidor da API. Compartilhado entre
// criar, editar e mudar status da vaga, para as três rotas responderem igual.
export function toJobPostingResponse(vaga: Job): JobPostingResponseDto {
  return {
    id: vaga.id,
    title: vaga.title,
    description: vaga.description,
    requirements: vaga.requirements ?? undefined,
    salary: vaga.salary?.toNumber(),
    contractType: vaga.contractType,
    status: vaga.status,
    urgent: vaga.urgent,
    restaurantId: vaga.restaurantId,
    createdAt: vaga.createdAt,
  };
}
