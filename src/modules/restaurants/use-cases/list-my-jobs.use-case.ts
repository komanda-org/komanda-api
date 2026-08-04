import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMyJobsResponseDto } from '../dto/my-job-response.dto';

interface ListMyJobsInput {
  restauranteId: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class ListMyJobsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListMyJobsInput): Promise<ListMyJobsResponseDto> {
    const skip = input.skip ?? 0;
    const take = input.take ?? 20;

    // restauranteId vem sempre do token (ver controller) — o gestor só
    // enxerga as próprias vagas, nunca as de outro restaurante.
    const where: Prisma.JobWhereInput = {
      restaurantId: input.restauranteId,
      active: true,
      deletedAt: null,
    };

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs.map((job) => ({
        id: job.id,
        titulo: job.title,
        descricao: job.description,
        requisitos: job.requirements,
        salario: job.salary ? job.salary.toString() : null,
        tipoContrato: job.contractType,
        status: job.status,
        createdAt: job.createdAt,
      })),
      total,
      skip,
      take,
    };
  }
}
