import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseKeywords, SearchJobsUseCase } from './search-jobs.use-case';
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
    shift: 'NOITE',
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
        where: { ...baseWhere, shift: 'NOITE' },
      }),
    );
    expect(mockPrisma.job.count).toHaveBeenCalledWith({
      where: { ...baseWhere, shift: 'NOITE' },
    });
  });

  it('should not add a shift key to the where when shift is not sent', async () => {
    await useCase.execute({ contractType: ContractType.CLT });

    const [[callArgs]] = mockPrisma.job.findMany.mock.calls as [
      [{ where: Prisma.JobWhereInput }],
    ];
    expect(callArgs.where).not.toHaveProperty('shift');
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

  it('should map a null shift for jobs created before the shift column', async () => {
    mockPrisma.job.findMany.mockResolvedValue([{ ...mockJob, shift: null }]);

    const result = await useCase.execute({});

    expect(result.data[0].shift).toBeNull();
  });

  it('should map the response fields, including a null salary', async () => {
    mockPrisma.job.findMany.mockResolvedValue([{ ...mockJob, salary: null }]);

    const result = await useCase.execute({});

    expect(result.data[0]).toMatchObject({
      id: 'job-1',
      title: 'Chef de cozinha',
      salary: null,
      shift: 'NOITE',
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
