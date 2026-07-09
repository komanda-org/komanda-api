import { Injectable } from '@nestjs/common';
import { JobStatus, PrismaClient } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListJobsQueryDto } from '../dto/list-jobs-query.dto';
import { ListJobsResponseDto } from '../dto/job-response.dto';

@Injectable()
export class ListJobsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListJobsQueryDto): Promise<ListJobsResponseDto> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;

    const where = {
      status: JobStatus.ABERTA,
      active: true,
    };

    const client = this.prisma as unknown as PrismaClient;

    const [jobs, total] = await Promise.all([
      client.job.findMany({
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
      client.job.count({ where }),
    ]);

    return {
      data: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        description: job.description,
        requirements: job.requirements,
        salary: job.salary ? job.salary.toString() : null,
        contractType: job.contractType,
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
