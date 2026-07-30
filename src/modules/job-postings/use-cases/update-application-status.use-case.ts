import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Candidatura, CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface UpdateApplicationStatusInput {
  vagaId: string;
  candidaturaId: string;
  restauranteId: string;
  status: CandidaturaStatus;
}

const STATUS_TERMINAIS: CandidaturaStatus[] = [
  CandidaturaStatus.APROVADA,
  CandidaturaStatus.REJEITADA,
];

@Injectable()
export class UpdateApplicationStatusUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateApplicationStatusInput): Promise<Candidatura> {
    const candidatura = await this.prisma.candidatura.findUnique({
      where: { id: input.candidaturaId },
      include: { job: true },
    });

    // Candidatura de outra vaga, ou de vaga excluída logicamente, é tratada
    // como inexistente para esta rota (mesmo critério do ListJobApplicantsUseCase).
    if (
      !candidatura ||
      candidatura.jobId !== input.vagaId ||
      candidatura.job.deletedAt
    ) {
      throw new NotFoundException('Candidatura não encontrada');
    }

    // O restauranteId vem do token: um restaurante não altera candidaturas de vaga alheia.
    if (candidatura.job.restaurantId !== input.restauranteId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta candidatura',
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

    return this.prisma.candidatura.update({
      where: { id: input.candidaturaId },
      data: { status: input.status },
    });
  }
}
