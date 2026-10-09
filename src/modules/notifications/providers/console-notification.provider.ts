import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateNotificacaoParams,
  INotificacaoService,
  NewMessageNotificationParams,
} from '../interfaces/notification-service.interface';

// Limite da coluna `titulo` (VarChar(200)) no schema.
const TITULO_MAX = 200;

// Persiste em `notificacoes` e mantém o log. Erros de banco sobem de propósito:
// quem chama decide se a falha pode ser engolida (ex.: não quebrar a vaga).
@Injectable()
export class ConsoleNotificationProvider implements INotificacaoService {
  private readonly logger = new Logger(ConsoleNotificationProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateNotificacaoParams): Promise<void> {
    await this.prisma.notificacao.create({
      data: {
        userId: params.userId,
        titulo: params.title.slice(0, TITULO_MAX),
        mensagem: params.message,
      },
    });

    this.logger.log(
      `Notificação para ${params.userId}: [${params.title}] ${params.message}`,
    );
  }

  async createMany(params: CreateNotificacaoParams[]): Promise<number> {
    // Nada a notificar: evita uma ida ao banco à toa.
    if (params.length === 0) {
      return 0;
    }

    const { count } = await this.prisma.notificacao.createMany({
      data: params.map((p) => ({
        userId: p.userId,
        titulo: p.title.slice(0, TITULO_MAX),
        mensagem: p.message,
      })),
    });

    this.logger.log(`${count} notificações criadas em lote`);
    return count;
  }

  async notifyNewMessage(params: NewMessageNotificationParams): Promise<void> {
    await this.create({
      userId: params.recipientId,
      title: `Nova mensagem de ${params.senderName}`,
      message: params.preview,
    });
  }
}
