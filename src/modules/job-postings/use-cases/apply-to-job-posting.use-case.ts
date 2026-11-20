import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Candidatura, JobStatus, Prisma } from '@prisma/client';
import { VISIBLE_RESTAURANT_WHERE } from 'src/modules/jobs/job.mapper';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobEventNotifier } from '../job-event-notifier';

@Injectable()
export class ApplyToJobPostingUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: JobEventNotifier,
  ) {}

  async execute(jobId: string, professionalId: string): Promise<Candidatura> {
    // Vaga de restaurante excluído é tratada como inexistente, igual à lista.
    const vaga = await this.prisma.job.findFirst({
      where: { id: jobId, restaurant: VISIBLE_RESTAURANT_WHERE },
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
      await this.notifier.newApplication({
        restaurantId: candidatura.job.restaurantId,
        jobTitle: candidatura.job.title,
        professionalName: candidatura.professional.fullName,
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
