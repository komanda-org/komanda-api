import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Candidatura, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ApplyToJobPostingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(jobId: string, professionalId: string): Promise<Candidatura> {
    const vaga = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true, active: true, deletedAt: true },
    });

    if (!vaga || vaga.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    if (!vaga.active) {
      throw new UnprocessableEntityException(
        'A vaga não está disponível para candidaturas',
      );
    }

    if (vaga.status !== JobStatus.ABERTA) {
      throw new UnprocessableEntityException(
        'A vaga não está aberta para candidaturas',
      );
    }

    try {
      const candidatura = await this.prisma.candidatura.create({
        data: {
          jobId,
          professionalId,
        },
        include: {
          job: true,
          professional: {
            include: {
              user: true,
            },
          },
        },
      });
      return candidatura;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Você já se candidatou a esta vaga');
      }
      throw error;
    }
  }
}
