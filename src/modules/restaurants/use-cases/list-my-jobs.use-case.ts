import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMyJobsResponseDto } from '../dto/my-job-response.dto';

interface ListMyJobsInput {
  restaurantId: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class ListMyJobsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListMyJobsInput): Promise<ListMyJobsResponseDto> {
    const skip = input.skip ?? 0;
    const take = input.take ?? 20;

    // restaurantId vem sempre do token (ver controller) — o gestor só
    // enxerga as próprias vagas, nunca as de outro restaurante.
    const where: Prisma.JobWhereInput = {
      restaurantId: input.restaurantId,
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
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        salary: job.salary?.toNumber() ?? null,
        contractType: job.contractType,
        shifts: job.shifts,
        status: job.status,
        urgent: job.urgent,
        createdAt: job.createdAt,
      })),
      total,
      skip,
      take,
    };
  }
}
