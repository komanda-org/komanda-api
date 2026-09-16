import { Injectable } from '@nestjs/common';
import { CandidaturaStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMyApplicationsResponseDto } from '../dto/my-application-response.dto';

interface ListMyApplicationsInput {
  professionalId: string;
  status?: CandidaturaStatus;
  skip?: number;
  take?: number;
}

@Injectable()
export class ListMyApplicationsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    input: ListMyApplicationsInput,
  ): Promise<ListMyApplicationsResponseDto> {
    const skip = input.skip ?? 0;
    const take = input.take ?? 20;

    // professionalId vem sempre do token (ver controller) — o profissional
    // só enxerga o próprio histórico, nunca o de terceiros.
    const where: Prisma.CandidaturaWhereInput = {
      professionalId: input.professionalId,
      ...(input.status ? { status: input.status } : {}),
    };

    const [applications, total] = await Promise.all([
      this.prisma.candidatura.findMany({
        where,
        skip,
        take,
        // Movimentações mais recentes no topo, para o profissional ver
        // rapidamente o que mudou ao abrir o aplicativo.
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          job: {
            select: {
              id: true,
              title: true,
              restaurant: {
                select: {
                  userId: true,
                  restaurantName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.candidatura.count({ where }),
    ]);

    return {
      data: applications.map((application) => ({
        applicationId: application.id,
        status: application.status,
        applicationDate: application.createdAt,
        job: {
          id: application.job.id,
          title: application.job.title,
        },
        restaurant: {
          id: application.job.restaurant.userId,
          name: application.job.restaurant.restaurantName,
        },
      })),
      total,
      skip,
      take,
    };
  }
}
