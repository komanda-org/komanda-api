import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, JobStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CandidatarVagaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(vagaId: string, profissionalId: string): Promise<any> {
    // 1. Verify vaga exists and is open
    const vaga = await this.prisma.job.findUnique({
      where: { id: vagaId },
    });

    if (!vaga) {
      throw new NotFoundException('Vaga não encontrada');
    }

    if (vaga.status !== JobStatus.ABERTA) {
      throw new UnprocessableEntityException('A vaga não está aberta para candidaturas');
    }

    // 2. Attempt to create candidacy
    try {
      const candidatura = await this.prisma.candidatura.create({
        data: {
          jobId: vagaId,
          profissionalId,
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

      // Return a DTO-like object (we'll let controller map)
      return candidatura;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint failure on jobId + profissionalId
        throw new ConflictException('Você já se candidatou a esta vaga');
      }
      throw error;
    }
  }
}