import { ContractType, Job, JobStatus, JobShift } from '@prisma/client';

export interface JobPostingResponseDto {
  id: string;
  title: string;
  description: string;
  requirements?: string;
  salary?: number;
  contractType: ContractType;
  shifts: JobShift[];
  status: JobStatus;
  urgent: boolean;
  restaurantId: string;
  createdAt: Date;
}

// Só campos públicos: updatedAt/deletedAt/active/closedAt não vazam na resposta.
export function toJobPostingResponse(vaga: Job): JobPostingResponseDto {
  return {
    id: vaga.id,
    title: vaga.title,
    description: vaga.description,
    requirements: vaga.requirements ?? undefined,
    salary: vaga.salary?.toNumber(),
    contractType: vaga.contractType,
    shifts: vaga.shifts,
    status: vaga.status,
    urgent: vaga.urgent,
    restaurantId: vaga.restaurantId,
    createdAt: vaga.createdAt,
  };
}
