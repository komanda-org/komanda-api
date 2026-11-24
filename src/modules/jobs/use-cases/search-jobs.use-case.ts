import { BadRequestException, Injectable } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  Coordinates,
  haversineKm,
  haversineKmSql,
  roundKm,
} from 'src/common/geocoding/haversine';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';
import { JobResponseDto, ListJobsResponseDto } from '../dto/job-response.dto';
import {
  JobWithPublicRestaurant,
  PUBLIC_RESTAURANT_SELECT,
  VISIBLE_RESTAURANT_WHERE,
  toJobResponse,
} from '../job.mapper';

// Coordenadas entram só para calcular distanceKm; o mapper não as devolve.
const SEARCH_RESTAURANT_SELECT = {
  ...PUBLIC_RESTAURANT_SELECT,
  latitude: true,
  longitude: true,
} satisfies Prisma.RestaurantSelect;

type JobWithLocatedRestaurant = JobWithPublicRestaurant & {
  restaurant: { latitude: number | null; longitude: number | null };
};

@Injectable()
export class SearchJobsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: SearchJobsQueryDto): Promise<ListJobsResponseDto> {
    const skip = query.skip ?? 0;
    const take = query.take ?? 20;
    const origin = resolveOrigin(query);
    const keywords = parseKeywords(query.query);

    if (origin && query.maxDistanceKm !== undefined) {
      return this.searchWithinRadius(
        query,
        keywords,
        origin,
        query.maxDistanceKm,
        skip,
        take,
      );
    }

    const where: Prisma.JobWhereInput = {
      active: true,
      deletedAt: null,
      status: JobStatus.ABERTA,
      restaurant: VISIBLE_RESTAURANT_WHERE,
    };

    if (keywords.length > 0) {
      where.id = { in: await this.findJobIdsMatchingAll(keywords) };
    }

    if (query.contractType) {
      where.contractType = query.contractType;
    }

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
        include: {
          restaurant: {
            select: origin
              ? SEARCH_RESTAURANT_SELECT
              : PUBLIC_RESTAURANT_SELECT,
          },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs.map((job) =>
        origin
          ? withDistance(
              job as JobWithLocatedRestaurant,
              distanceFrom(origin, job as JobWithLocatedRestaurant),
            )
          : toJobResponse(job),
      ),
      total,
      skip,
      take,
    };
  }

  // Raio, total, ordem e paginação, tudo no banco: o Prisma não ordena por
  // expressão calculada, então os filtros desta busca viram SQL. Mantenha em
  // sincronia com o `where` de execute() e com VISIBLE_RESTAURANT_WHERE.
  private async searchWithinRadius(
    query: SearchJobsQueryDto,
    keywords: string[],
    origin: Coordinates,
    maxDistanceKm: number,
    skip: number,
    take: number,
  ): Promise<ListJobsResponseDto> {
    const distance = haversineKmSql(origin, 'r.latitude', 'r.longitude');

    const conditions: Prisma.Sql[] = [
      Prisma.sql`j.active`,
      Prisma.sql`j.deleted_at IS NULL`,
      Prisma.sql`j.status = 'ABERTA'`,
      Prisma.sql`r.active`,
      Prisma.sql`r.deleted_at IS NULL`,
      Prisma.sql`u.active`,
      Prisma.sql`u.deleted_at IS NULL`,
      // Sem coordenadas (itinerante ou geocodificação falhou) não entra no raio.
      Prisma.sql`r.latitude IS NOT NULL`,
      Prisma.sql`r.longitude IS NOT NULL`,
      Prisma.sql`${distance} <= ${maxDistanceKm}::float8`,
      ...keywordConditions(keywords),
    ];

    if (query.contractType) {
      conditions.push(
        Prisma.sql`j.contract_type = ${query.contractType}::"ContractType"`,
      );
    }
    if (query.shift) {
      conditions.push(Prisma.sql`${query.shift}::"JobShift" = ANY(j.shifts)`);
    }
    if (query.minSalary !== undefined && query.minSalary !== null) {
      conditions.push(Prisma.sql`j.salary >= ${query.minSalary}::numeric`);
    }

    const from = Prisma.sql`
      FROM jobs j
      JOIN restaurants r ON r.user_id = j.restaurant_id
      JOIN users u ON u.id = r.user_id
      WHERE ${Prisma.join(conditions, ' AND ')}
    `;

    const [page, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; distance_km: number }[]>`
        SELECT j.id, ${distance} AS distance_km
        ${from}
        ORDER BY distance_km ASC, j.created_at DESC, j.id ASC
        LIMIT ${take} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total
        ${from}
      `,
    ]);

    const jobs =
      page.length === 0
        ? []
        : await this.prisma.job.findMany({
            where: { id: { in: page.map((row) => row.id) } },
            include: { restaurant: { select: PUBLIC_RESTAURANT_SELECT } },
          });
    const byId = new Map(jobs.map((job) => [job.id, job]));

    // findMany não garante ordem: a da página (distância) é a que vale.
    const data = page.flatMap((row) => {
      const job = byId.get(row.id);
      return job
        ? [{ ...toJobResponse(job), distanceKm: roundKm(row.distance_km) }]
        : [];
    });

    return { data, total, skip, take };
  }

  // Cada palavra precisa aparecer em algum lugar da vaga (título, descrição,
  // requisitos ou nome do restaurante), em qualquer ordem, ignorando
  // maiúsculas e acentos: "garcom noite" acha "Garçom" do turno da noite
  // escrito na descrição. O Prisma não tem unaccent, por isso o SQL aqui;
  // status, filtros e paginação continuam no findMany.
  private async findJobIdsMatchingAll(keywords: string[]): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT j.id
      FROM jobs j
      JOIN restaurants r ON r.user_id = j.restaurant_id
      WHERE j.active AND j.deleted_at IS NULL AND j.status = 'ABERTA'
        AND ${Prisma.join(keywordConditions(keywords), ' AND ')}
    `;

    return rows.map((row) => row.id);
  }
}

// Uma condição por palavra; usa os aliases j (jobs) e r (restaurants).
function keywordConditions(keywords: string[]): Prisma.Sql[] {
  return keywords.map(
    (word) =>
      Prisma.sql`unaccent(concat_ws(' ', j.title, j.description, j.requirements, r."restaurantName")) ILIKE unaccent(${`%${escapeLike(word)}%`})`,
  );
}

// lat e lng andam juntos; raio sem origem não tem de onde medir.
function resolveOrigin(query: SearchJobsQueryDto): Coordinates | null {
  const hasLat = query.lat !== undefined && query.lat !== null;
  const hasLng = query.lng !== undefined && query.lng !== null;

  if (hasLat !== hasLng) {
    throw new BadRequestException('lat e lng devem ser enviados juntos');
  }
  if (!hasLat) {
    if (query.maxDistanceKm !== undefined && query.maxDistanceKm !== null) {
      throw new BadRequestException(
        'maxDistanceKm exige lat e lng (posição do profissional)',
      );
    }
    return null;
  }
  return { latitude: query.lat!, longitude: query.lng! };
}

function distanceFrom(
  origin: Coordinates,
  job: JobWithLocatedRestaurant,
): number | null {
  const { latitude, longitude } = job.restaurant;
  if (latitude === null || longitude === null) return null;
  return roundKm(haversineKm(origin, { latitude, longitude }));
}

function withDistance(
  job: JobWithLocatedRestaurant,
  distanceKm: number | null,
): JobResponseDto {
  return { ...toJobResponse(job), distanceKm };
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
