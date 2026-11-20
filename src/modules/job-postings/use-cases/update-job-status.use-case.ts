import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { CandidaturaStatus, JobStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobEventNotifier } from '../job-event-notifier';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: JobEventNotifier,
  ) {}

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

    const encerrando = input.status === JobStatus.ENCERRADA;

    const atualizarVaga = this.prisma.job.update({
      // Fecha a corrida: se outra requisição mudou o status, nenhuma linha casa.
      where: { id: input.jobId, status: vaga.status },
      data: {
        status: input.status,
        // RNF12: ENCERRADA é final, então closedAt nunca é sobrescrito.
        ...(encerrando ? { closedAt: new Date() } : {}),
      },
    });

    try {
      if (!encerrando) {
        return toJobPostingResponse(await atualizarVaga);
      }

      // Quem vai ser recusado, para avisar depois do commit.
      const pendentes = await this.prisma.candidatura.findMany({
        where: { jobId: input.jobId, status: CandidaturaStatus.PENDENTE },
        select: { professionalId: true },
      });

      // Vaga encerrada não tem mais seleção: quem ainda esperava resposta é
      // recusado, para não ficar "Pendente" para sempre. Aprovadas ficam como
      // estão. Mesma transação: se o update da vaga falhar (409), nada muda.
      const [vagaAtualizada] = await this.prisma.$transaction([
        atualizarVaga,
        this.prisma.candidatura.updateMany({
          where: { jobId: input.jobId, status: CandidaturaStatus.PENDENTE },
          data: { status: CandidaturaStatus.REJEITADA },
        }),
      ]);

      if (pendentes.length > 0) {
        await this.notifier.safely(
          `vaga encerrada ${input.jobId}`,
          async () => {
            const restaurante = await this.prisma.restaurant.findUnique({
              where: { userId: input.restaurantId },
              select: { restaurantName: true },
            });
            await this.notifier.pendingClosedWithJob({
              professionalIds: pendentes.map((p) => p.professionalId),
              jobTitle: vagaAtualizada.title,
              restaurantName: restaurante?.restaurantName ?? 'O restaurante',
            });
          },
        );
      }

      return toJobPostingResponse(vagaAtualizada);
    } catch (error) {
      rethrowJobConflict(
        error,
        'O status da vaga foi alterado por outra requisição. Tente novamente.',
      );
    }
  }
}
