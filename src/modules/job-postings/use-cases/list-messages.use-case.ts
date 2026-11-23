import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssertChatAccessUseCase } from './assert-chat-access';

interface ListMessagesInput {
  jobId: string;
  userId: string;
  /** Obrigatório para o restaurante; ignorado para o profissional. */
  professionalId?: string;
  before?: Date;
  take?: number;
}

interface MessageResponse {
  id: string;
  jobId: string;
  professionalId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

interface ListMessagesResponse {
  /** Profissional da conversa já resolvido pelo gate. */
  professionalId: string;
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
    // Valida o gate e resolve de quem é a conversa
    const conversation = await this.assertChatAccess.execute({
      jobId: input.jobId,
      userId: input.userId,
      professionalId: input.professionalId,
    });

    // take default 50, máx 100
    const take = Math.min(input.take ?? 50, 100);

    // Só as mensagens desta conversa: outro aprovado na mesma vaga não entra.
    const where: Prisma.MessageWhereInput = {
      jobId: conversation.jobId,
      professionalId: conversation.professionalId,
      ...(input.before ? { createdAt: { lt: input.before } } : {}),
    };

    // Busca take + 1 para determinar hasMore
    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      select: {
        id: true,
        jobId: true,
        professionalId: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    const hasMore = messages.length > take;
    const limitedMessages = hasMore ? messages.slice(0, take) : messages;

    // Resposta sempre ascendente (mais antigo primeiro)
    return {
      professionalId: conversation.professionalId,
      messages: [...limitedMessages].reverse(),
      hasMore,
    };
  }
}
