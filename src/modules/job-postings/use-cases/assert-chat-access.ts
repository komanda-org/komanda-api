import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export const PROFESSIONAL_ID_REQUIRED_MESSAGE = 'professionalId é obrigatório';
const NO_APPROVED_APPLICATION_MESSAGE =
  'Só é possível conversar após uma candidatura aprovada na vaga';

interface AssertChatAccessInput {
  jobId: string;
  userId: string;
  /**
   * Com quem é a conversa. Obrigatório para o restaurante (a vaga pode ter
   * vários aprovados); para o profissional é ignorado e vale o próprio id.
   */
  professionalId?: string;
}

/** A conversa liberada: vaga + profissional + restaurante dono da vaga. */
export interface ChatConversation {
  jobId: string;
  professionalId: string;
  restaurantId: string;
}

@Injectable()
export class AssertChatAccessUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: AssertChatAccessInput): Promise<ChatConversation> {
    // Bloqueia usuários soft-deleted ou inativos
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, active: true, deletedAt: true },
    });

    if (!user || !user.active || user.deletedAt) {
      throw new ForbiddenException(NO_APPROVED_APPLICATION_MESSAGE);
    }

    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, restaurantId: true, active: true, deletedAt: true },
    });

    if (!job || !job.active || job.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    const isRestaurantOwner = job.restaurantId === input.userId;
    if (isRestaurantOwner && !input.professionalId) {
      throw new BadRequestException(PROFESSIONAL_ID_REQUIRED_MESSAGE);
    }

    // O profissional só abre a PRÓPRIA conversa: o professionalId do cliente
    // é ignorado. Restaurante que não é dono cai aqui e recebe 403 abaixo.
    const professionalId = isRestaurantOwner
      ? (input.professionalId as string)
      : input.userId;

    // Nos dois lados a conversa só existe com candidatura APROVADA do
    // profissional nessa vaga.
    const approvedApplication = await this.prisma.candidatura.findFirst({
      where: {
        jobId: input.jobId,
        professionalId,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });

    if (!approvedApplication) {
      throw new ForbiddenException(NO_APPROVED_APPLICATION_MESSAGE);
    }

    return {
      jobId: input.jobId,
      professionalId,
      restaurantId: job.restaurantId,
    };
  }
}
