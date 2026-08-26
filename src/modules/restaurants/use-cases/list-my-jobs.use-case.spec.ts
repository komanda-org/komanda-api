import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMyJobsUseCase } from './list-my-jobs.use-case';

const createMockPrisma = () => ({
  job: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ListMyJobsUseCase', () => {
  let useCase: ListMyJobsUseCase;
  let prisma: MockPrisma;

  const RESTAURANTE_ID = 'restaurant-1';
  const createdAt = new Date('2026-07-10T12:00:00Z');

  const jobRow = {
    id: 'job-1',
    title: 'Chef de Cozinha',
    description: 'Responsável pela cozinha',
    requirements: 'Experiência mínima de 2 anos',
    salary: new Prisma.Decimal('3500.00'),
    contractType: ContractType.CLT,
    status: JobStatus.ABERTA,
    createdAt,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListMyJobsUseCase(prisma as unknown as PrismaService);
  });

  it('lista as vagas do restaurante com os campos esperados', async () => {
    prisma.job.findMany.mockResolvedValue([jobRow]);
    prisma.job.count.mockResolvedValue(1);

    const result = await useCase.execute({ restauranteId: RESTAURANTE_ID });

    expect(result).toEqual({
      data: [
        {
          id: 'job-1',
          titulo: 'Chef de Cozinha',
          descricao: 'Responsável pela cozinha',
          requisitos: 'Experiência mínima de 2 anos',
          salario: 3500,
          tipoContrato: ContractType.CLT,
          status: JobStatus.ABERTA,
          createdAt,
        },
      ],
      total: 1,
      skip: 0,
      take: 20,
    });
  });

  it('busca somente as vagas do restaurante do token, ativas e não excluídas', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);

    await useCase.execute({ restauranteId: RESTAURANTE_ID });

    const where = {
      restaurantId: RESTAURANTE_ID,
      active: true,
      deletedAt: null,
    };
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: { createdAt: 'desc' } }),
    );
    expect(prisma.job.count).toHaveBeenCalledWith({ where });
  });

  it('aplica skip/take informados na paginação', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);

    const result = await useCase.execute({
      restauranteId: RESTAURANTE_ID,
      skip: 10,
      take: 5,
    });

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
    expect(result.skip).toBe(10);
    expect(result.take).toBe(5);
  });

  it('usa skip/take padrão quando não informados', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);

    const result = await useCase.execute({ restauranteId: RESTAURANTE_ID });

    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('retorna lista vazia quando o restaurante não tem vagas', async () => {
    prisma.job.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);

    const result = await useCase.execute({ restauranteId: RESTAURANTE_ID });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
