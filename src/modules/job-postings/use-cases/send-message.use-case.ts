import { Injectable } from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobEventNotifier } from '../job-event-notifier';
import { AssertChatAccessUseCase } from './assert-chat-access';

interface SendMessageInput {
  jobId: string;
  senderId: string;
  content: string;
  /**
   * Quem está com a conversa aberta agora (presença do gateway). Essas pessoas
   * já recebem a mensagem ao vivo, então não ganham notificação.
   */
  onlineUserIds?: ReadonlySet<string>;
}

interface MessageResponse {
  id: string;
  jobId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assertChatAccess: AssertChatAccessUseCase,
    private readonly notifier: JobEventNotifier,
  ) {}

  async execute(input: SendMessageInput): Promise<MessageResponse> {
    // Revalida o gate (não confia no join anterior: a candidatura pode ter sido revertida)
    await this.assertChatAccess.execute({
      jobId: input.jobId,
      userId: input.senderId,
    });

    const message = await this.prisma.message.create({
      data: {
        jobId: input.jobId,
        senderId: input.senderId,
        content: input.content,
      },
      select: {
        id: true,
        jobId: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    await this.notifier.safely(`mensagem da vaga ${input.jobId}`, () =>
      this.notifyOtherSide(input),
    );

    return message;
  }

  // Do restaurante para os aprovados da vaga; do profissional para o restaurante.
  private async notifyOtherSide(input: SendMessageInput): Promise<void> {
    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: {
        restaurantId: true,
        restaurant: { select: { restaurantName: true } },
        candidaturas: {
          where: { status: CandidaturaStatus.APROVADA },
          select: {
            professionalId: true,
            professional: { select: { fullName: true } },
          },
        },
      },
    });
    if (!job) return;

    const fromRestaurant = job.restaurantId === input.senderId;
    const senderName = fromRestaurant
      ? job.restaurant.restaurantName
      : job.candidaturas.find((c) => c.professionalId === input.senderId)
          ?.professional.fullName;
    const recipientIds = (
      fromRestaurant
        ? job.candidaturas.map((c) => c.professionalId)
        : [job.restaurantId]
    ).filter((id) => id !== input.senderId && !input.onlineUserIds?.has(id));

    if (!senderName || recipientIds.length === 0) return;

    await this.notifier.newMessage({
      recipientIds,
      senderName,
      content: input.content,
    });
  }
}
