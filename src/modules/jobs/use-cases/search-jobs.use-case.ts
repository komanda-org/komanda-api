import { Injectable } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';
import { ListJobsResponseDto } from '../dto/job-response.dto';
import { PUBLIC_RESTAURANT_SELECT, toJobResponse } from '../job.mapper';

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

    // Filtro por distância fica fora do MVP: exigiria geolocalização
    // (coordenadas + cálculo espacial); o bairro textual (RF02) é a
    // localização aceita por ora.

    // Turno já chega normalizado e validado pelo DTO; a vaga entra se tiver
    // esse turno entre os dela (MANHA acha "MANHA" e "MANHA + TARDE").
    if (query.shift) {
      where.shifts = { has: query.shift };
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
        include: { restaurant: { select: PUBLIC_RESTAURANT_SELECT } },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs.map(toJobResponse),
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
