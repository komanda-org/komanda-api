import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageResponseDto } from '../dto/message-response.dto';

interface ListMessagesInput {
  jobId: string;
  userId: string;
  userRole: Role;
}

@Injectable()
export class ListMessagesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListMessagesInput): Promise<MessageResponseDto[]> {
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
    if (input.userRole === Role.PROFISSIONAL) {
      const aprovada = await this.prisma.candidatura.findFirst({
        where: {
          jobId: input.jobId,
          professionalId: input.userId,
          status: CandidaturaStatus.APROVADA,
        },
        select: { id: true },
      });

      if (!aprovada) {
        throw new ForbiddenException(
          'Só é possível listar mensagens após uma candidatura aprovada na vaga',
        );
      }
    } else {
      // RESTAURANTE: só o dono da vaga acessa as mensagens dela.
      if (vaga.restaurantId !== input.userId) {
        throw new ForbiddenException(
          'Você não tem permissão para listar mensagens desta vaga',
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
          'Só é possível listar mensagens após uma candidatura aprovada na vaga',
        );
      }
    }

    return this.prisma.message.findMany({
      where: { jobId: input.jobId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
