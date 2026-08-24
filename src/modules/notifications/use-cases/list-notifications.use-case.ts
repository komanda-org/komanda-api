import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationResponseDto } from '../dto/notification-response.dto';

interface ListNotificationsInput {
  userId: string;
  skip: number;
  take: number;
}

export interface ListNotificationsResult {
  data: NotificationResponseDto[];
  total: number;
  skip: number;
  take: number;
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: ListNotificationsInput,
  ): Promise<ListNotificationsResult> {
    const [data, total] = await Promise.all([
      this.prisma.notificacao.findMany({
        where: { userId: input.userId },
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.notificacao.count({
        where: { userId: input.userId },
      }),
    ]);

    return {
      data: data.map((n) => ({
        id: n.id,
        titulo: n.titulo,
        mensagem: n.mensagem,
        lida: n.lida,
        createdAt: n.createdAt,
      })),
      total,
      skip: input.skip,
      take: input.take,
    };
  }
}
