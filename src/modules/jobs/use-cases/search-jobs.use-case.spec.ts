import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SearchJobsUseCase } from './search-jobs.use-case';
import { SearchJobsQueryDto } from '../dto/search-jobs-query.dto';

// Mock tipado no lugar de `any`: só os métodos do Prisma que o use case usa.
type PrismaMock = {
  job: { findMany: jest.Mock; count: jest.Mock };
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
      zipCode: '01001-000',
      averageRating: 4.5,
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
          OR: [
            { title: { contains: 'chef', mode: 'insensitive' } },
            { description: { contains: 'chef', mode: 'insensitive' } },
          ],
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
        orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
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
        orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('should only apply the query filter when it is the only param sent', async () => {
    await useCase.execute({ query: '  chef  ' });

    expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ...baseWhere,
          OR: [
            { title: { contains: 'chef', mode: 'insensitive' } },
            { description: { contains: 'chef', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('should ignore a blank query instead of filtering by an empty string', async () => {
    await useCase.execute({ query: '   ' });

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
        zipCode: '01001-000',
        averageRating: 4.5,
      },
    });
  });
});
