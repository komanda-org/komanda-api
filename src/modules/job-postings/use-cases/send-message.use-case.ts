import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssertChatAccessUseCase } from './assert-chat-access';

interface SendMessageInput {
  jobId: string;
  senderId: string;
  content: string;
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

    return message;
  }
}
