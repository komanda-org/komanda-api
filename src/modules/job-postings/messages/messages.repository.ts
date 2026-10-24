import { Injectable } from '@nestjs/common';
import { Message, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.MessageCreateInput): Promise<Message> {
    return this.prisma.message.create({ data });
  }

  async findByJobId(jobId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { jobId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
}
