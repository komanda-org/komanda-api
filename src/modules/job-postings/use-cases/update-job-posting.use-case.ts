import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContractType, JobStatus } from '@prisma/client';
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
  requirements: string;
  salary: number;
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

    const vagaAtualizada = await this.prisma.job.update({
      where: { id: input.jobId },
      // O @IsOptional que o PartialType aplica deixa passar null, não só
      // undefined. Sem o `?? undefined`, um { "title": null } chegaria ao
      // Prisma numa coluna NOT NULL e viraria erro 500. Aqui null vale como
      // "campo não enviado" — e undefined o Prisma simplesmente ignora.
      data: {
        title: changes.title ?? undefined,
        description: changes.description ?? undefined,
        requirements: changes.requirements ?? undefined,
        salary: changes.salary ?? undefined,
        contractType: changes.contractType ?? undefined,
        urgent: changes.urgent ?? undefined,
      },
    });

    return toJobPostingResponse(vagaAtualizada);
  }
}
