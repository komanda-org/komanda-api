import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface AssertChatAccessInput {
  jobId: string;
  userId: string;
}

@Injectable()
export class AssertChatAccessUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: AssertChatAccessInput): Promise<void> {
    // 1. user ativo / não deletado → senão 403
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, active: true, deletedAt: true },
    });

    if (!user || !user.active || user.deletedAt) {
      throw new ForbiddenException(
        'Só é possível conversar após uma candidatura aprovada na vaga',
      );
    }

    // 2. job existe, ativo, não deletado → senão 404
    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, restaurantId: true, active: true, deletedAt: true },
    });

    if (!job || !job.active || job.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    // 3. job.restaurantId === userId → libera (lado restaurante)
    if (job.restaurantId === input.userId) {
      return;
    }

    // 4. candidatura { jobId, professionalId: userId, status: APROVADA } → senão 403
    const approvedApplication = await this.prisma.candidatura.findFirst({
      where: {
        jobId: input.jobId,
        professionalId: input.userId,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });

    if (!approvedApplication) {
      throw new ForbiddenException(
        'Só é possível conversar após uma candidatura aprovada na vaga',
      );
    }
  }
}
