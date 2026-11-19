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

    const keywords = parseKeywords(query.query);
    if (keywords.length > 0) {
      where.id = { in: await this.findJobIdsMatchingAll(keywords) };
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
            // Só dados públicos do restaurante. zipCode e address alimentam o
            // cálculo de distância do front; CNPJ e telefone nunca saem aqui.
            select: {
              restaurantName: true,
              logoUrl: true,
              cuisineType: true,
              averageRating: true,
              address: true,
              zipCode: true,
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
        urgent: job.urgent,
        restaurantId: job.restaurantId,
        restaurant: {
          restaurantName: job.restaurant.restaurantName,
          logoUrl: job.restaurant.logoUrl,
          cuisineType: job.restaurant.cuisineType,
          averageRating: job.restaurant.averageRating,
          address: job.restaurant.address,
          zipCode: job.restaurant.zipCode,
        },
        createdAt: job.createdAt,
      })),
      total,
      skip,
      take,
    };
  }

  // Cada palavra precisa aparecer em algum lugar da vaga (título, descrição,
  // requisitos ou nome do restaurante), em qualquer ordem, ignorando
  // maiúsculas e acentos: "garcom noite" acha "Garçom" do turno da noite
  // escrito na descrição. O Prisma não tem unaccent, por isso o SQL aqui;
  // status, filtros e paginação continuam no findMany.
  private async findJobIdsMatchingAll(keywords: string[]): Promise<string[]> {
    const conditions = keywords.map(
      (word) =>
        Prisma.sql`unaccent(concat_ws(' ', j.title, j.description, j.requirements, r."restaurantName")) ILIKE unaccent(${`%${escapeLike(word)}%`})`,
    );

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT j.id
      FROM jobs j
      JOIN restaurants r ON r.user_id = j.restaurant_id
      WHERE j.active AND j.deleted_at IS NULL AND j.status = 'ABERTA'
        AND ${Prisma.join(conditions, ' AND ')}
    `;

    return rows.map((row) => row.id);
  }
}

const MAX_KEYWORDS = 10;

// "  Garçom   noite garçom " -> ["garçom", "noite"]
export function parseKeywords(raw: string | undefined): string[] {
  if (!raw) return [];
  const words = raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return [...new Set(words)].slice(0, MAX_KEYWORDS);
}

// % e _ digitados pelo usuário são texto, não curingas do LIKE.
function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (char) => `\\${char}`);
}
