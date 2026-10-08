import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  JobPostingResponseDto,
  toJobPostingResponse,
} from '../dto/job-posting-response.dto';

interface UpdateJobStatusInput {
  jobId: string;
  restaurantId: string;
  status: JobStatus;
}

// Tabela de transições: para cada status atual, para onde a vaga pode ir.
// O Record<JobStatus, ...> obriga a ter uma chave para CADA valor do enum —
// se um status novo for criado no schema, o TS acusa aqui até alguém decidir
// as regras dele. ENCERRADA não leva a lugar nenhum: é estado final.
const TRANSICOES_PERMITIDAS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.ABERTA]: [JobStatus.PAUSADA, JobStatus.ENCERRADA],
  [JobStatus.PAUSADA]: [JobStatus.ABERTA, JobStatus.ENCERRADA],
  [JobStatus.ENCERRADA]: [],
};

@Injectable()
export class UpdateJobStatusUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateJobStatusInput): Promise<JobPostingResponseDto> {
    const vaga = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: {
        restaurantId: true,
        status: true,
        active: true,
        deletedAt: true,
      },
    });

    // Mesmo critério do UpdateJobPostingUseCase: excluída logicamente = inexistente.
    if (!vaga || !vaga.active || vaga.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    // O restaurantId vem do token: um restaurante não pausa/encerra vaga alheia.
    if (vaga.restaurantId !== input.restaurantId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar o status desta vaga',
      );
    }

    if (!TRANSICOES_PERMITIDAS[vaga.status].includes(input.status)) {
      throw new UnprocessableEntityException(
        `Não é possível mudar a vaga de ${vaga.status} para ${input.status}`,
      );
    }

    try {
      const vagaAtualizada = await this.prisma.job.update({
        // O `status` no where é a rede de segurança contra corrida: se outra
        // requisição mudou o status entre o findUnique e aqui (ex.: encerrou
        // enquanto esta pausava), nenhuma linha casa e o Prisma lança P2025 —
        // em vez de "ressuscitar" uma vaga já encerrada.
        where: { id: input.jobId, status: vaga.status },
        data: {
          status: input.status,
          // RNF12: o momento do encerramento fica gravado para auditoria.
          // Como ENCERRADA é final, closedAt nunca é sobrescrito depois.
          ...(input.status === JobStatus.ENCERRADA
            ? { closedAt: new Date() }
            : {}),
        },
      });

      return toJobPostingResponse(vagaAtualizada);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(
          'O status da vaga foi alterado por outra requisição. Tente novamente.',
        );
      }
      throw error;
    }
  }
}
