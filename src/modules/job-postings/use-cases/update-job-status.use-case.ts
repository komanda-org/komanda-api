import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  JobPostingResponseDto,
  toJobPostingResponse,
} from '../dto/job-posting-response.dto';
import { findOwnedJob, rethrowJobConflict } from './find-owned-job';

interface UpdateJobStatusInput {
  jobId: string;
  restaurantId: string;
  status: JobStatus;
}

// Record<JobStatus, ...> obriga uma entrada para cada status do enum:
// status novo no schema quebra o typecheck até alguém definir as transições.
const TRANSICOES_PERMITIDAS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.ABERTA]: [JobStatus.PAUSADA, JobStatus.ENCERRADA],
  [JobStatus.PAUSADA]: [JobStatus.ABERTA, JobStatus.ENCERRADA],
  [JobStatus.ENCERRADA]: [],
};

@Injectable()
export class UpdateJobStatusUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateJobStatusInput): Promise<JobPostingResponseDto> {
    const vaga = await findOwnedJob(
      this.prisma,
      input.jobId,
      input.restaurantId,
    );

    if (!TRANSICOES_PERMITIDAS[vaga.status].includes(input.status)) {
      throw new UnprocessableEntityException(
        `Não é possível mudar a vaga de ${vaga.status} para ${input.status}`,
      );
    }

    try {
      const vagaAtualizada = await this.prisma.job.update({
        // Fecha a corrida: se outra requisição mudou o status, nenhuma linha casa.
        where: { id: input.jobId, status: vaga.status },
        data: {
          status: input.status,
          // RNF12: ENCERRADA é final, então closedAt nunca é sobrescrito.
          ...(input.status === JobStatus.ENCERRADA
            ? { closedAt: new Date() }
            : {}),
        },
      });

      return toJobPostingResponse(vagaAtualizada);
    } catch (error) {
      rethrowJobConflict(
        error,
        'O status da vaga foi alterado por outra requisição. Tente novamente.',
      );
    }
  }
}
