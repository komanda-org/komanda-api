import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Candidatura, CandidaturaStatus, JobStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobEventNotifier } from '../job-event-notifier';

interface UpdateApplicationStatusInput {
  jobId: string;
  applicationId: string;
  restaurantId: string;
  status: CandidaturaStatus;
}

const STATUS_TERMINAIS: CandidaturaStatus[] = [
  CandidaturaStatus.APROVADA,
  CandidaturaStatus.REJEITADA,
];

@Injectable()
export class UpdateApplicationStatusUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: JobEventNotifier,
  ) {}

  async execute(input: UpdateApplicationStatusInput): Promise<Candidatura> {
    const candidatura = await this.prisma.candidatura.findUnique({
      where: { id: input.applicationId },
      include: {
        job: { include: { restaurant: { select: { restaurantName: true } } } },
      },
    });

    // Candidatura de outra vaga, ou de vaga excluída logicamente, é tratada
    // como inexistente para esta rota (mesmo critério do ListJobApplicantsUseCase).
    if (
      !candidatura ||
      candidatura.jobId !== input.jobId ||
      candidatura.job.deletedAt
    ) {
      throw new NotFoundException('Candidatura não encontrada');
    }

    // O restauranteId vem do token: um restaurante não altera candidaturas de vaga alheia.
    if (candidatura.job.restaurantId !== input.restaurantId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta candidatura',
      );
    }

    // Depois do 403: restaurante alheio não descobre o status da vaga.
    // Encerrar a vaga já recusou as pendentes; o resultado fica congelado.
    if (candidatura.job.status === JobStatus.ENCERRADA) {
      throw new UnprocessableEntityException(
        'Não é possível alterar candidaturas de uma vaga encerrada',
      );
    }

    if (
      STATUS_TERMINAIS.includes(candidatura.status) &&
      input.status === CandidaturaStatus.PENDENTE
    ) {
      throw new UnprocessableEntityException(
        'Não é possível reverter uma candidatura já avaliada para PENDENTE',
      );
    }

    const atualizada = await this.prisma.candidatura.update({
      where: { id: input.applicationId },
      data: { status: input.status },
    });

    // Reenviar o mesmo status não gera aviso repetido.
    if (candidatura.status !== input.status) {
      await this.notifier.applicationDecided({
        professionalId: candidatura.professionalId,
        jobTitle: candidatura.job.title,
        restaurantName: candidatura.job.restaurant.restaurantName,
        status: input.status,
      });
    }

    return atualizada;
  }
}
