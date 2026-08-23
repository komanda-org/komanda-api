import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListAvaliacoesResponseDto } from '../dto/avaliacao-response.dto';

interface ListAvaliacoesRecebidasInput {
  usuarioId: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class ListAvaliacoesRecebidasUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: ListAvaliacoesRecebidasInput,
  ): Promise<ListAvaliacoesResponseDto> {
    const skip = input.skip ?? 0;
    const take = input.take ?? 20;

    const usuario = await this.prisma.user.findUnique({
      where: { id: input.usuarioId },
      select: { id: true },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const where = { avaliadoId: input.usuarioId };

    const [avaliacoes, total, aggregate] = await Promise.all([
      this.prisma.avaliacao.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nota: true,
          comentario: true,
          avaliadorId: true,
          createdAt: true,
        },
      }),
      this.prisma.avaliacao.count({ where }),
      this.prisma.avaliacao.aggregate({ where, _avg: { nota: true } }),
    ]);

    return {
      data: avaliacoes,
      total,
      skip,
      take,
      mediaNotas: aggregate._avg.nota,
    };
  }
}
