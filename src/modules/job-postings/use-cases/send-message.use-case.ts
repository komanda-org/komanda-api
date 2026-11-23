import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JobEventNotifier } from '../job-event-notifier';
import {
  AssertChatAccessUseCase,
  ChatConversation,
} from './assert-chat-access';

interface SendMessageInput {
  jobId: string;
  senderId: string;
  /** Obrigatório para o restaurante; ignorado para o profissional. */
  professionalId?: string;
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
  professionalId: string;
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
    const conversation = await this.assertChatAccess.execute({
      jobId: input.jobId,
      userId: input.senderId,
      professionalId: input.professionalId,
    });

    const message = await this.prisma.message.create({
      data: {
        jobId: conversation.jobId,
        professionalId: conversation.professionalId,
        senderId: input.senderId,
        content: input.content,
      },
      select: {
        id: true,
        jobId: true,
        professionalId: true,
        senderId: true,
        content: true,
        createdAt: true,
      },
    });

    await this.notifier.safely(`mensagem da vaga ${input.jobId}`, () =>
      this.notifyOtherSide(input, conversation),
    );

    return message;
  }

  // Só o outro lado DESTA conversa: o restaurante avisa apenas o profissional
  // com quem está falando, e o profissional avisa o restaurante.
  private async notifyOtherSide(
    input: SendMessageInput,
    conversation: ChatConversation,
  ): Promise<void> {
    const fromRestaurant = input.senderId === conversation.restaurantId;
    const recipientId = fromRestaurant
      ? conversation.professionalId
      : conversation.restaurantId;

    if (input.onlineUserIds?.has(recipientId)) return;

    const senderName = fromRestaurant
      ? (
          await this.prisma.restaurant.findUnique({
            where: { userId: conversation.restaurantId },
            select: { restaurantName: true },
          })
        )?.restaurantName
      : (
          await this.prisma.professional.findUnique({
            where: { userId: conversation.professionalId },
            select: { fullName: true },
          })
        )?.fullName;

    if (!senderName) return;

    await this.notifier.newMessage({
      recipientIds: [recipientId],
      senderName,
      content: input.content,
    });
  }
}
