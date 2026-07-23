import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMyApplicationsUseCase } from './list-my-applications.use-case';

const createMockPrisma = () => ({
  candidatura: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ListMyApplicationsUseCase', () => {
  let useCase: ListMyApplicationsUseCase;
  let prisma: MockPrisma;

  const PROFISSIONAL_ID = 'professional-1';
  const dataCandidatura = new Date('2026-07-10T12:00:00Z');

  const candidaturaRow = {
    id: 'candidatura-1',
    status: CandidaturaStatus.PENDENTE,
    createdAt: dataCandidatura,
    job: {
      id: 'job-1',
      title: 'Chef de Cozinha',
      restaurant: {
        userId: 'restaurant-1',
        restaurantName: 'Restaurante Sabor & Arte',
      },
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListMyApplicationsUseCase(prisma as unknown as PrismaService);
  });

  it('lista o histórico de candidaturas do profissional com vaga e restaurante', async () => {
    prisma.candidatura.findMany.mockResolvedValue([candidaturaRow]);
    prisma.candidatura.count.mockResolvedValue(1);

    const result = await useCase.execute({ profissionalId: PROFISSIONAL_ID });

    expect(result).toEqual({
      data: [
        {
          candidaturaId: 'candidatura-1',
          status: CandidaturaStatus.PENDENTE,
          dataCandidatura,
          vaga: {
            id: 'job-1',
            titulo: 'Chef de Cozinha',
          },
          restaurante: {
            id: 'restaurant-1',
            nome: 'Restaurante Sabor & Arte',
          },
        },
      ],
      total: 1,
      skip: 0,
      take: 20,
    });
  });

  it('busca somente as candidaturas do profissional do token', async () => {
    prisma.candidatura.findMany.mockResolvedValue([]);
    prisma.candidatura.count.mockResolvedValue(0);

    await useCase.execute({ profissionalId: PROFISSIONAL_ID });

    const where = { professionalId: PROFISSIONAL_ID };
    expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: { createdAt: 'desc' } }),
    );
    expect(prisma.candidatura.count).toHaveBeenCalledWith({ where });
  });

  it('filtra por status quando o query param é informado', async () => {
    prisma.candidatura.findMany.mockResolvedValue([candidaturaRow]);
    prisma.candidatura.count.mockResolvedValue(1);

    await useCase.execute({
      profissionalId: PROFISSIONAL_ID,
      status: CandidaturaStatus.APROVADA,
    });

    const where = {
      professionalId: PROFISSIONAL_ID,
      status: CandidaturaStatus.APROVADA,
    };
    expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(prisma.candidatura.count).toHaveBeenCalledWith({ where });
  });

  it('aplica skip/take informados na paginação', async () => {
    prisma.candidatura.findMany.mockResolvedValue([]);
    prisma.candidatura.count.mockResolvedValue(0);

    const result = await useCase.execute({
      profissionalId: PROFISSIONAL_ID,
      skip: 10,
      take: 5,
    });

    expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
    expect(result.skip).toBe(10);
    expect(result.take).toBe(5);
  });

  it('usa skip/take padrão quando não informados', async () => {
    prisma.candidatura.findMany.mockResolvedValue([]);
    prisma.candidatura.count.mockResolvedValue(0);

    const result = await useCase.execute({ profissionalId: PROFISSIONAL_ID });

    expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('retorna lista vazia quando o profissional não tem candidaturas', async () => {
    prisma.candidatura.findMany.mockResolvedValue([]);
    prisma.candidatura.count.mockResolvedValue(0);

    const result = await useCase.execute({ profissionalId: PROFISSIONAL_ID });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
