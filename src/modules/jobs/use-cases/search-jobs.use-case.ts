import { Injectable } from '@nestjs/common';
import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';
import { ListJobsResponseDto } from '../dto/job-response.dto';

@Injectable()
export class SearchJobsUseCase {
    constructor(private readonly prisma: PrismaService) { }

    async execute(query: SearchJobsQueryDto): Promise<ListJobsResponseDto> {
        const skip = query.skip ?? 0;
        const take = query.take ?? 20;

        const where: Prisma.JobWhereInput = {
            active: true,
            deletedAt: null,
            status: JobStatus.ABERTA,
        };

        if (query.termo && query.termo.trim()) {
            const termo = query.termo.trim();
            where.OR = [
                {
                    title: {
                        contains: termo,
                        mode: 'insensitive',
                    },
                },
                {
                    description: {
                        contains: termo,
                        mode: 'insensitive',
                    },
                },
            ];
        }

        if (query.tipoContrato) {
            where.contractType = query.tipoContrato as ContractType;
        }

        if (query.salarioMinimo !== undefined && query.salarioMinimo !== null) {
            where.salary = { gte: new Prisma.Decimal(query.salarioMinimo) };
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
