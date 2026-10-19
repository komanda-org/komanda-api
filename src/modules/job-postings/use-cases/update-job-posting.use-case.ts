import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  JobPostingResponseDto,
  toJobPostingResponse,
} from '../dto/job-posting-response.dto';

// Campos que o dono pode editar. `status` fica de fora: pausar/encerrar tem
// regras de transição próprias e vive em um use case separado.
interface JobPostingChanges {
  title: string;
  description: string;
  // Anuláveis no schema: null é um valor válido aqui (remove o dado).
  requirements: string | null;
  salary: number | null;
  contractType: ContractType;
  urgent: boolean;
}

interface UpdateJobPostingInput {
  jobId: string;
  restaurantId: string;
  // Partial: no PATCH o dono manda só o que quer mudar.
  changes: Partial<JobPostingChanges>;
}

@Injectable()
export class UpdateJobPostingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateJobPostingInput): Promise<JobPostingResponseDto> {
    const vaga = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: {
        restaurantId: true,
        status: true,
        active: true,
        deletedAt: true,
      },
    });

    // Mesmo critério do ListJobApplicantsUseCase: excluída logicamente = inexistente.
    if (!vaga || !vaga.active || vaga.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    // O restaurantId vem do token: um restaurante não edita vaga alheia.
    if (vaga.restaurantId !== input.restaurantId) {
      throw new ForbiddenException(
        'Você não tem permissão para editar esta vaga',
      );
    }

    // Vaga encerrada é registro histórico (RNF12): editar depois do
    // encerramento apagaria o que de fato foi anunciado.
    if (vaga.status === JobStatus.ENCERRADA) {
      throw new UnprocessableEntityException(
        'Não é possível editar uma vaga encerrada',
      );
    }

    const { changes } = input;

    try {
      const vagaAtualizada = await this.prisma.job.update({
        // Mesma rede de segurança do UpdateJobStatusUseCase: se outra
        // requisição encerrou a vaga entre o findUnique e aqui, nenhuma linha
        // casa e o Prisma lança P2025 — em vez de editar uma vaga encerrada.
        where: { id: input.jobId, status: { not: JobStatus.ENCERRADA } },
        // O @IsOptional que o PartialType aplica deixa passar null, não só
        // undefined. Nas colunas NOT NULL, null vale como "campo não enviado"
        // (`?? undefined`, que o Prisma ignora). Nas anuláveis (requirements e
        // salary) o null passa direto: undefined = não muda, null = limpa.
        data: {
          title: changes.title ?? undefined,
          description: changes.description ?? undefined,
          requirements: changes.requirements,
          salary: changes.salary,
          contractType: changes.contractType ?? undefined,
          urgent: changes.urgent ?? undefined,
        },
      });

      return toJobPostingResponse(vagaAtualizada);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new ConflictException(
          'A vaga foi alterada por outra requisição. Tente novamente.',
        );
      }
      throw error;
    }
  }
}
