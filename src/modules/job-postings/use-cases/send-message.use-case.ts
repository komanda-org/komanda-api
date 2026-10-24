import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface SendMessageInput {
  jobId: string;
  senderId: string;
  senderRole: Role;
  content: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: SendMessageInput) {
    const vaga = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, restaurantId: true, active: true, deletedAt: true },
    });

    // Vaga excluída logicamente é indistinguível de inexistente para a API.
    if (!vaga || !vaga.active || vaga.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    // Gate central: só há conversa quando existe candidatura APROVADA
    // entre as partes da vaga (espelha create-review.use-case.ts:79-94).
    if (input.senderRole === Role.PROFISSIONAL) {
      const aprovada = await this.prisma.candidatura.findFirst({
        where: {
          jobId: input.jobId,
          professionalId: input.senderId,
          status: CandidaturaStatus.APROVADA,
        },
        select: { id: true },
      });

      if (!aprovada) {
        throw new ForbiddenException(
          'Só é possível enviar mensagem após uma candidatura aprovada na vaga',
        );
      }
    } else {
      // RESTAURANTE: só o dono da vaga conversa com quem foi aprovado nela.
      if (vaga.restaurantId !== input.senderId) {
        throw new ForbiddenException(
          'Você não tem permissão para enviar mensagens nesta vaga',
        );
      }

      const aprovada = await this.prisma.candidatura.findFirst({
        where: {
          jobId: input.jobId,
          status: CandidaturaStatus.APROVADA,
        },
        select: { id: true },
      });

      if (!aprovada) {
        throw new ForbiddenException(
          'Só é possível enviar mensagem após uma candidatura aprovada na vaga',
        );
      }
    }

    return this.prisma.message.create({
      data: {
        jobId: input.jobId,
        senderId: input.senderId,
        content: input.content,
      },
    });
  }
}
