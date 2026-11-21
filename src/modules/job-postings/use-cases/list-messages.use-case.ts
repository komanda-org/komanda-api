import { Injectable } from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssertChatAccessUseCase } from './assert-chat-access';

interface ListMessagesInput {
  jobId: string;
  userId: string;
  before?: Date;
  take?: number;
}

interface MessageResponse {
  id: string;
  jobId: string;
  /** O profissional da conversa: o próprio remetente se for profissional, ou o único aprovado na vaga quando for restaurante. */
  professionalId: string | null;
  senderId: string;
  content: string;
  createdAt: Date;
}

interface ListMessagesResponse {
  messages: MessageResponse[];
  hasMore: boolean;
}

@Injectable()
export class ListMessagesUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertChatAccess: AssertChatAccessUseCase,
  ) {}

  async execute(input: ListMessagesInput): Promise<ListMessagesResponse> {
    // Valida o gate
    await this.assertChatAccess.execute({
      jobId: input.jobId,
      userId: input.userId,
    });

    // take default 50, máx 100
    const take = Math.min(input.take ?? 50, 100);

    const where: any = {
      jobId: input.jobId,
    };

    if (input.before) {
      where.createdAt = { lt: input.before };
    }

    // Busca take + 1 para determinar hasMore
    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      select: {
        id: true,
        jobId: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    // Descobre o professionalId de cada mensagem para o front filtrar por conversa.
    // Remetente profissional com candidatura aprovada → professionalId = próprio id.
    // Remetente restaurante → professionalId do único aprovado (se houver só um); senão null (broadcast).
    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: {
        restaurantId: true,
        candidaturas: {
          where: { status: CandidaturaStatus.APROVADA },
          select: { professionalId: true },
        },
      },
    });

    const restaurantId = job?.restaurantId ?? null;
    const approvedProfessionals = job?.candidaturas.map((c) => c.professionalId) ?? [];

    const messagesWithProfessionalId = messages.map((m) => {
      if (approvedProfessionals.includes(m.senderId)) {
        return { ...m, professionalId: m.senderId };
      }
      if (m.senderId === restaurantId && approvedProfessionals.length === 1) {
        return { ...m, professionalId: approvedProfessionals[0] };
      }
      return { ...m, professionalId: null };
    });

    const hasMore = messages.length > take;
    const limitedMessages = hasMore
      ? messagesWithProfessionalId.slice(0, take)
      : messagesWithProfessionalId;

    const sortedMessages = [...limitedMessages].reverse();

    return {
      messages: sortedMessages,
      hasMore,
    };
  }
}
