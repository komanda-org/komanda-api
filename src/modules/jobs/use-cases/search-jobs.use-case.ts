import { Injectable } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';
import { ListJobsResponseDto } from '../dto/job-response.dto';

@Injectable()
export class SearchJobsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchJobsQueryDto): Promise<ListJobsResponseDto> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where: Prisma.JobWhereInput = {
      active: true,
      deletedAt: null,
      status: JobStatus.ABERTA,
    };

    if (query.query && query.query.trim()) {
      const search = query.query.trim();
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.contractType) {
      where.contractType = query.contractType;
    }

    // Turno já chega normalizado (trim + maiúsculas) pelo DTO.
    // Filtro por distância fica fora do MVP: exigiria geolocalização
    // (coordenadas + cálculo espacial); o bairro textual (RF02) é a
    // localização aceita por ora.
    if (query.shift) {
      where.shift = query.shift;
    }

    if (query.minSalary !== undefined && query.minSalary !== null) {
      where.salary = { gte: new Prisma.Decimal(query.minSalary) };
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          restaurant: {
            select: {
              restaurantName: true,
              logoUrl: true,
            },
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        salary: job.salary ? job.salary.toString() : null,
        contractType: job.contractType,
        shift: job.shift,
        status: job.status,
        restaurantId: job.restaurantId,
        restaurant: {
          restaurantName: job.restaurant.restaurantName,
          logoUrl: job.restaurant.logoUrl,
        },
        createdAt: job.createdAt,
      })),
      total,
      skip,
      take,
    };
  }
}
