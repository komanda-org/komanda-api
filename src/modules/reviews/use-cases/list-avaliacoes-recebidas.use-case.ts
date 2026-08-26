import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
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
      select: { role: true, active: true, deletedAt: true },
    });

    // Usuário soft-deletado ou inativo é indistinguível de inexistente para a API.
    if (!usuario || !usuario.active || usuario.deletedAt) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // O recebedor da avaliação é sempre o lado oposto de quem a escreveu:
    // se :id é profissional, buscamos avaliações escritas por restaurantes
    // (e vice-versa).
    const isProfissional = usuario.role === Role.PROFISSIONAL;
    const where: Prisma.AvaliacaoWhereInput = isProfissional
      ? { professionalId: input.usuarioId, avaliadorRole: Role.RESTAURANTE }
      : { restaurantId: input.usuarioId, avaliadorRole: Role.PROFISSIONAL };

    const [avaliacoes, total, aggregate] = await Promise.all([
      this.prisma.avaliacao.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          comment: true,
          jobId: true,
          professionalId: true,
          restaurantId: true,
          createdAt: true,
        },
      }),
      this.prisma.avaliacao.count({ where }),
      this.prisma.avaliacao.aggregate({ where, _avg: { rating: true } }),
    ]);

    return {
      data: avaliacoes.map((avaliacao) => ({
        id: avaliacao.id,
        rating: avaliacao.rating,
        comment: avaliacao.comment,
        jobId: avaliacao.jobId,
        avaliadorId: isProfissional
          ? avaliacao.restaurantId
          : avaliacao.professionalId,
        createdAt: avaliacao.createdAt,
      })),
      total,
      skip,
      take,
      averageRating: aggregate._avg.rating,
    };
  }
}
