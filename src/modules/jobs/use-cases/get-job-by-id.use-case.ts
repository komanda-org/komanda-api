import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobDetailResponseDto } from '../dto/job-detail-response.dto';
import {
  PUBLIC_RESTAURANT_SELECT,
  VISIBLE_RESTAURANT_WHERE,
  toJobResponse,
} from '../job.mapper';

@Injectable()
export class GetJobByIdUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    jobId: string,
    user: JwtPayload,
  ): Promise<JobDetailResponseDto> {
    // Uma consulta: vaga, restaurante público e a candidatura do usuário do
    // token. Para restaurante o filtro de candidatura nunca casa (o id dele
    // não é de profissional), então a lista volta vazia.
    const job = await this.prisma.job.findFirst({
      where: {
        id: jobId,
        active: true,
        deletedAt: null,
        restaurant: VISIBLE_RESTAURANT_WHERE,
      },
      include: {
        restaurant: { select: PUBLIC_RESTAURANT_SELECT },
        candidaturas: {
          where: { professionalId: user.id },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
    });

    // Todo caso negado responde o mesmo 404: não revela que a vaga existe.
    if (!job || !this.canSee(job, user)) {
      throw new NotFoundException('Vaga não encontrada');
    }

    const application = job.candidaturas[0] ?? null;

    return {
      ...toJobResponse(job),
      hasApplied: application !== null,
      application,
    };
  }

  private canSee(
    job: { restaurantId: string; status: JobStatus; candidaturas: unknown[] },
    user: JwtPayload,
  ): boolean {
    // Restaurante só vê as próprias vagas, em qualquer status (pré-visualização).
    if (user.role === Role.RESTAURANTE) {
      return job.restaurantId === user.id;
    }
    // Profissional vê vaga aberta; pausada/encerrada só se já se candidatou
    // (quem abre pelo "Minhas candidaturas").
    return job.status === JobStatus.ABERTA || job.candidaturas.length > 0;
  }
}
