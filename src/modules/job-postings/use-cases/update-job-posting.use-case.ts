import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ContractType, JobStatus, JobShift } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  JobPostingResponseDto,
  toJobPostingResponse,
} from '../dto/job-posting-response.dto';
import { findOwnedJob, rethrowJobConflict } from './find-owned-job';

// `status` fica de fora: pausar/encerrar tem transições próprias (update-job-status).
interface JobPostingChanges {
  title: string;
  description: string;
  // Anuláveis no schema: null remove o dado.
  requirements: string | null;
  salary: number | null;
  // Lista final de turnos; [] apaga (o DTO converte null em []).
  shifts: JobShift[];
  contractType: ContractType;
  urgent: boolean;
}

interface UpdateJobPostingInput {
  jobId: string;
  restaurantId: string;
  changes: Partial<JobPostingChanges>;
}

@Injectable()
export class UpdateJobPostingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateJobPostingInput): Promise<JobPostingResponseDto> {
    const vaga = await findOwnedJob(
      this.prisma,
      input.jobId,
      input.restaurantId,
    );

    // Vaga encerrada é registro histórico (RNF12).
    if (vaga.status === JobStatus.ENCERRADA) {
      throw new UnprocessableEntityException(
        'Não é possível editar uma vaga encerrada',
      );
    }

    const { changes } = input;

    try {
      const vagaAtualizada = await this.prisma.job.update({
        // Fecha a corrida com o PATCH /:id/status.
        where: { id: input.jobId, status: { not: JobStatus.ENCERRADA } },
        // `undefined` = não muda; `null` só passa nas colunas anuláveis (limpa).
        data: {
          title: changes.title ?? undefined,
          description: changes.description ?? undefined,
          requirements: changes.requirements,
          salary: changes.salary,
          shifts: changes.shifts,
          contractType: changes.contractType ?? undefined,
          urgent: changes.urgent ?? undefined,
        },
      });

      return toJobPostingResponse(vagaAtualizada);
    } catch (error) {
      rethrowJobConflict(
        error,
        'A vaga foi alterada por outra requisição. Tente novamente.',
      );
    }
  }
}
