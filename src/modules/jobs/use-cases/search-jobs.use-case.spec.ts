import { BadRequestException } from '@nestjs/common';
import { ContractType, JobStatus, Prisma, JobShift } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseKeywords, SearchJobsUseCase } from './search-jobs.use-case';
import { VISIBLE_RESTAURANT_WHERE } from '../job.mapper';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';

// Mock tipado no lugar de `any`: só os métodos do Prisma que o use case usa.
type PrismaMock = {
  job: { findMany: jest.Mock; count: jest.Mock };
  $queryRaw: jest.Mock;
};

// Texto do SQL e parâmetros de uma chamada a $queryRaw`...`. Como tagged
// template, o mock recebe (strings, ...valores); Prisma.sql remonta a query.
const rawCall = (mock: jest.Mock, index = 0) => {
  const [strings, ...values] = mock.mock.calls[index] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  const sql = Prisma.sql(strings, ...values);
  return { text: sql.sql, values: sql.values };
};

describe('SearchJobsUseCase', () => {
  let useCase: SearchJobsUseCase;
  let mockPrisma: PrismaMock;

  const now = new Date();

  const mockJob = {
    id: 'job-1',
    title: 'Chef de cozinha',
    description: 'Preparação de pratos gourmet',
    requirements: 'Experiência mínima de 2 anos',
    salary: { toString: () => '5000.00' },
    contractType: ContractType.CLT,
    shifts: [JobShift.NOITE],
    status: JobStatus.ABERTA,
    urgent: true,
    restaurantId: 'restaurant-1',
    restaurant: {
      restaurantName: 'Restaurante Exemplo',
      logoUrl: 'https://example.com/logo.png',
      cuisineType: 'Italiana',
      averageRating: 4.5,
      address: 'Rua A, 123 - Centro, São Paulo - SP',
      zipCode: '01001-000',
      cnpj: '11222333000181',
      phone: '(11) 99999-9999',
    },
    createdAt: now,
  };

  const baseWhere = {
    active: true,
    deletedAt: null,
    status: JobStatus.ABERTA,
    // Vaga de restaurante excluído não aparece no feed.
    restaurant: VISIBLE_RESTAURANT_WHERE,
  };

  beforeEach(() => {
    mockPrisma = {
      job: {
        findMany: jest.fn().mockResolvedValue([mockJob]),
        count: jest.fn().mockResolvedValue(1),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'job-1' }]),
    };

    useCase = new SearchJobsUseCase(mockPrisma as unknown as PrismaService);
  });

  it('should apply all filters dynamically and return paginated results', async () => {
    const query: SearchJobsQueryDto = {
      query: 'chef',
      contractType: ContractType.CLT,
      minSalary: 4000,
      skip: 0,
      take: 10,
    };

    const result = await useCase.execute(query);

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(10);
    expect(result.data[0].title).toBe('Chef de cozinha');
    expect(result.data[0].contractType).toBe(ContractType.CLT);
    expect(result.data[0].urgent).toBe(true);
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ...baseWhere,
          contractType: ContractType.CLT,
          salary: { gte: expect.any(Object) },
          id: { in: ['job-1'] },
        }),
      }),
    );
  });

  it('should default skip and take when the query is completely empty', async () => {
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.job.count.mockResolvedValue(0);

    const result = await useCase.execute({});

    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: baseWhere,
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should keep the default open jobs feed when no filters are provided', async () => {
    const query: SearchJobsQueryDto = { skip: 0, take: 20 };

    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.job.count.mockResolvedValue(0);

    const result = await useCase.execute(query);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should only apply the query filter when it is the only param sent', async () => {
    await useCase.execute({ query: '  chef  ' });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...baseWhere, id: { in: ['job-1'] } },
      }),
    );
    expect(mockPrisma.job.count).toHaveBeenCalledWith({
      where: { ...baseWhere, id: { in: ['job-1'] } },
    });
  });

  it('should require every keyword, ignoring accents, across all text fields', async () => {
    await useCase.execute({ query: 'Garçom  NOITE' });

    const { text, values } = rawCall(mockPrisma.$queryRaw);
    // Uma condição por palavra, ligadas por AND.
    expect(text.match(/ILIKE unaccent\(/g)).toHaveLength(2);
    expect(text).toContain(' AND unaccent(');
    expect(text).toContain('j.requirements');
    expect(text).toContain('r."restaurantName"');
    expect(values).toEqual(['%garçom%', '%noite%']);
  });

  it('should return no jobs when no job matches the keywords', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockPrisma.job.count.mockResolvedValue(0);

    const result = await useCase.execute({ query: 'inexistente' });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...baseWhere, id: { in: [] } },
      }),
    );
    expect(result.total).toBe(0);
  });

  it('should treat % and _ typed by the user as literal text', async () => {
    await useCase.execute({ query: '100% a_b' });

    expect(rawCall(mockPrisma.$queryRaw).values).toEqual([
      '%100\\%%',
      '%a\\_b%',
    ]);
  });

  it('should ignore a blank query instead of filtering by an empty string', async () => {
    await useCase.execute({ query: '   ' });

    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: baseWhere }),
    );
  });

  it('should only apply the contractType filter when it is the only param sent', async () => {
    await useCase.execute({ contractType: ContractType.PJ });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...baseWhere, contractType: ContractType.PJ },
      }),
    );
  });

  it('should only apply the shift filter when it is the only param sent', async () => {
    await useCase.execute({ shift: 'NOITE' });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ...baseWhere, shifts: { has: 'NOITE' } },
      }),
    );
    expect(mockPrisma.job.count).toHaveBeenCalledWith({
      where: { ...baseWhere, shifts: { has: 'NOITE' } },
    });
  });

  it('should not add a shift key to the where when shift is not sent', async () => {
    await useCase.execute({ contractType: ContractType.CLT });

    const [[callArgs]] = mockPrisma.job.findMany.mock.calls as [
      [{ where: Prisma.JobWhereInput }],
    ];
    expect(callArgs.where).not.toHaveProperty('shifts');
  });

  it('should only apply the minSalary filter when it is the only param sent', async () => {
    await useCase.execute({ minSalary: 3000 });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...baseWhere,
          salary: { gte: expect.any(Object) },
        },
      }),
    );

    const [[callArgs]] = mockPrisma.job.findMany.mock.calls;
    expect(callArgs.where.salary.gte.toString()).toBe('3000');
  });

  it('should apply minSalary when it is zero', async () => {
    await useCase.execute({ minSalary: 0 });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...baseWhere,
          salary: { gte: expect.any(Object) },
        },
      }),
    );
  });

  it('should map an empty shifts list when the job has no shift', async () => {
    mockPrisma.job.findMany.mockResolvedValue([{ ...mockJob, shifts: [] }]);

    const result = await useCase.execute({});

    expect(result.data[0].shifts).toEqual([]);
  });

  it('should map the response fields, including a null salary', async () => {
    mockPrisma.job.findMany.mockResolvedValue([{ ...mockJob, salary: null }]);

    const result = await useCase.execute({});

    expect(result.data[0]).toMatchObject({
      id: 'job-1',
      title: 'Chef de cozinha',
      salary: null,
      shifts: [JobShift.NOITE],
      restaurant: {
        restaurantName: 'Restaurante Exemplo',
        logoUrl: 'https://example.com/logo.png',
      },
    });
  });

  it('should send the restaurant location for the distance filter, never CNPJ or phone', async () => {
    const result = await useCase.execute({});

    expect(result.data[0].restaurant).toEqual({
      restaurantName: 'Restaurante Exemplo',
      logoUrl: 'https://example.com/logo.png',
      cuisineType: 'Italiana',
      averageRating: 4.5,
      address: 'Rua A, 123 - Centro, São Paulo - SP',
      zipCode: '01001-000',
    });
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          restaurant: {
            select: expect.not.objectContaining({
              cnpj: true,
              phone: true,
            }) as unknown,
          },
        },
      }),
    );
  });
});

describe('SearchJobsUseCase — distância', () => {
  let useCase: SearchJobsUseCase;
  let mockPrisma: PrismaMock;

  // Profissional no centro de Salvador.
  const origin = { lat: -12.97, lng: -38.5 };

  const job = (
    id: string,
    coords: { latitude: number | null; longitude: number | null },
  ) => ({
    id,
    title: `Vaga ${id}`,
    description: 'Descrição',
    requirements: null,
    salary: null,
    contractType: ContractType.CLT,
    shifts: [],
    status: JobStatus.ABERTA,
    urgent: false,
    restaurantId: `restaurant-${id}`,
    restaurant: {
      restaurantName: `Restaurante ${id}`,
      logoUrl: null,
      cuisineType: 'Baiana',
      averageRating: null,
      address: 'Rua A, 1',
      zipCode: coords.latitude === null ? null : '40020-000',
      ...coords,
    },
    createdAt: new Date('2026-11-01T00:00:00Z'),
  });

  // $queryRaw responde a página (SELECT j.id ...) ou o total (count(*)).
  const mockRadiusQuery = (
    page: { id: string; distance_km: number }[],
    total: number,
  ) => {
    mockPrisma.$queryRaw.mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) =>
        Promise.resolve(
          Prisma.sql(strings, ...values).sql.includes('count(*)')
            ? [{ total }]
            : page,
        ),
    );
  };

  const pageQuery = () => {
    const index = mockPrisma.$queryRaw.mock.calls.findIndex(
      (_call, i) => !rawCall(mockPrisma.$queryRaw, i).text.includes('count(*)'),
    );
    return rawCall(mockPrisma.$queryRaw, index);
  };

  beforeEach(() => {
    mockPrisma = {
      job: { findMany: jest.fn(), count: jest.fn() },
      $queryRaw: jest.fn(),
    };
    useCase = new SearchJobsUseCase(mockPrisma as unknown as PrismaService);
  });

  it('devolve a vaga dentro do raio com distanceKm arredondado', async () => {
    mockRadiusQuery([{ id: 'perto', distance_km: 1.1234 }], 1);
    mockPrisma.job.findMany.mockResolvedValue([
      job('perto', { latitude: -12.96, longitude: -38.5 }),
    ]);

    const result = await useCase.execute({ ...origin, maxDistanceKm: 5 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 'perto', distanceKm: 1.1 });
    // Coordenadas do restaurante não saem na resposta.
    expect(result.data[0].restaurant).not.toHaveProperty('latitude');
  });

  it('filtra o raio no banco: vaga fora do raio não volta', async () => {
    mockRadiusQuery([], 0);

    const result = await useCase.execute({ ...origin, maxDistanceKm: 5 });

    const { text, values } = pageQuery();
    expect(text).toMatch(/asin\(least\(1, sqrt\(/);
    expect(text).toContain('<= ?::float8');
    expect(values).toContain(5);
    expect(result).toEqual({ data: [], total: 0, skip: 0, take: 20 });
    expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
  });

  it('deixa de fora restaurante sem coordenadas quando há raio', async () => {
    mockRadiusQuery([], 0);

    await useCase.execute({ ...origin, maxDistanceKm: 10 });

    const { text } = pageQuery();
    expect(text).toContain('r.latitude IS NOT NULL');
    expect(text).toContain('r.longitude IS NOT NULL');
  });

  it('o total conta só as vagas dentro do raio, não só a página', async () => {
    mockRadiusQuery([{ id: 'a', distance_km: 0.5 }], 12);
    mockPrisma.job.findMany.mockResolvedValue([
      job('a', { latitude: -12.97, longitude: -38.5 }),
    ]);

    const result = await useCase.execute({
      ...origin,
      maxDistanceKm: 5,
      take: 1,
    });

    expect(result.total).toBe(12);
    expect(mockPrisma.job.count).not.toHaveBeenCalled();
    const countCall = mockPrisma.$queryRaw.mock.calls.findIndex((_c, i) =>
      rawCall(mockPrisma.$queryRaw, i).text.includes('count(*)'),
    );
    // Mesmo WHERE da página, raio incluído.
    expect(rawCall(mockPrisma.$queryRaw, countCall).text).toContain(
      '<= ?::float8',
    );
  });

  it('pagina depois do filtro de raio, com LIMIT/OFFSET no SQL', async () => {
    mockRadiusQuery([], 30);

    const result = await useCase.execute({
      ...origin,
      maxDistanceKm: 5,
      skip: 20,
      take: 10,
    });

    const { text, values } = pageQuery();
    expect(text).toContain('LIMIT ? OFFSET ?');
    expect(values.slice(-2)).toEqual([10, 20]);
    expect(result).toMatchObject({ total: 30, skip: 20, take: 10 });
  });

  it('ordena por distância, mais perto primeiro, mesmo se o findMany embaralhar', async () => {
    mockRadiusQuery(
      [
        { id: 'perto', distance_km: 0.8 },
        { id: 'medio', distance_km: 2.35 },
        { id: 'longe', distance_km: 4.9 },
      ],
      3,
    );
    mockPrisma.job.findMany.mockResolvedValue([
      job('longe', { latitude: -13, longitude: -38.5 }),
      job('perto', { latitude: -12.97, longitude: -38.5 }),
      job('medio', { latitude: -12.99, longitude: -38.5 }),
    ]);

    const result = await useCase.execute({ ...origin, maxDistanceKm: 5 });

    expect(pageQuery().text).toContain('ORDER BY distance_km ASC');
    expect(result.data.map((j) => [j.id, j.distanceKm])).toEqual([
      ['perto', 0.8],
      ['medio', 2.4],
      ['longe', 4.9],
    ]);
  });

  it('leva os outros filtros para o SQL da busca com raio', async () => {
    mockRadiusQuery([], 0);

    await useCase.execute({
      ...origin,
      maxDistanceKm: 5,
      query: 'garçom',
      contractType: ContractType.PJ,
      shift: JobShift.NOITE,
      minSalary: 2000,
    });

    const { text, values } = pageQuery();
    expect(text).toContain('j.active');
    expect(text).toContain("j.status = 'ABERTA'");
    expect(text).toContain('u.deleted_at IS NULL');
    expect(text).toContain('ILIKE unaccent(');
    expect(text).toContain('j.contract_type = ?');
    expect(text).toContain('= ANY(j.shifts)');
    expect(text).toContain('j.salary >= ?');
    expect(values).toEqual(
      expect.arrayContaining([
        '%garçom%',
        ContractType.PJ,
        JobShift.NOITE,
        2000,
      ]),
    );
  });

  it.each([
    [{ maxDistanceKm: 5 }, /maxDistanceKm exige lat e lng/],
    [{ lat: -12.97, maxDistanceKm: 5 }, /lat e lng devem ser enviados juntos/],
    [{ lng: -38.5 }, /lat e lng devem ser enviados juntos/],
  ])('responde 400 para %p', async (query, message) => {
    const promise = useCase.execute(query);

    await expect(promise).rejects.toThrow(BadRequestException);
    await expect(promise).rejects.toThrow(message);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
  });

  it('com lat/lng e sem raio: mesma busca de hoje, com distanceKm (null sem coordenadas)', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      job('com-coord', { latitude: -12.96, longitude: -38.5 }),
      job('itinerante', { latitude: null, longitude: null }),
    ]);
    mockPrisma.job.count.mockResolvedValue(2);

    const result = await useCase.execute(origin);

    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
    expect(result.total).toBe(2);
    // 0,01° de latitude ≈ 1,1 km.
    expect(result.data.map((j) => j.distanceKm)).toEqual([1.1, null]);
  });

  it('sem lat/lng, a vaga não traz distanceKm', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      job('a', { latitude: -12.96, longitude: -38.5 }),
    ]);
    mockPrisma.job.count.mockResolvedValue(1);

    const result = await useCase.execute({});

    expect(result.data[0]).not.toHaveProperty('distanceKm');
    expect(result.data[0].restaurant).not.toHaveProperty('latitude');
  });
});

describe('parseKeywords', () => {
  it('separa por espaços, normaliza caixa e remove repetidas', () => {
    expect(parseKeywords('  Garçom   noite GARÇOM ')).toEqual([
      'garçom',
      'noite',
    ]);
  });

  it('devolve lista vazia para texto em branco ou ausente', () => {
    expect(parseKeywords('   ')).toEqual([]);
    expect(parseKeywords(undefined)).toEqual([]);
  });

  it('limita a 10 palavras', () => {
    const words = Array.from({ length: 15 }, (_, i) => `p${i}`).join(' ');
    expect(parseKeywords(words)).toHaveLength(10);
  });
});
