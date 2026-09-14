import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationResponseDto } from '../dto/notification-response.dto';

interface MarkAsReadInput {
  id: string;
  userId: string;
}

@Injectable()
export class MarkAsReadUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: MarkAsReadInput): Promise<NotificationResponseDto> {
    const notificacao = await this.prisma.notificacao.findUnique({
      where: { id: input.id },
    });

    if (!notificacao) {
      throw new NotFoundException('Notificação não encontrada');
    }

    if (notificacao.userId !== input.userId) {
      throw new ForbiddenException('Você não tem acesso a esta notificação');
    }

    const updated = await this.prisma.notificacao.update({
      where: { id: input.id },
      data: { lida: true },
    });

    return {
      id: updated.id,
      title: updated.titulo,
      message: updated.mensagem,
      read: updated.lida,
      createdAt: updated.createdAt,
    };
  }
}
