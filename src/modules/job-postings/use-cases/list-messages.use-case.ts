import { Injectable } from '@nestjs/common';
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

    const hasMore = messages.length > take;
    const limitedMessages = hasMore ? messages.slice(0, take) : messages;

    // Resposta sempre ascendente (mais antigo primeiro)
    const sortedMessages = [...limitedMessages].reverse();

    return {
      messages: sortedMessages,
      hasMore,
    };
  }
}
