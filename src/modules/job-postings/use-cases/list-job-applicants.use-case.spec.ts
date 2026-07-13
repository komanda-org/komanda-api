import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListJobApplicantsUseCase } from './list-job-applicants.use-case';

const createMockPrisma = () => ({
  job: {
    findUnique: jest.fn(),
  },
  candidatura: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ListJobApplicantsUseCase', () => {
  let useCase: ListJobApplicantsUseCase;
  let prisma: MockPrisma;

  const RESTAURANTE_ID = 'restaurant-1';
  const VAGA_ID = 'job-1';
  const dataCandidatura = new Date('2026-07-10T12:00:00Z');

  const vagaDoRestaurante = {
    restaurantId: RESTAURANTE_ID,
    active: true,
    deletedAt: null,
  };

  const candidaturaRow = {
    id: 'candidatura-1',
    status: CandidaturaStatus.PENDENTE,
    createdAt: dataCandidatura,
    professional: {
      userId: 'professional-1',
      fullName: 'Maria Souza',
      mainRole: 'Cozinheira',
      profilePhoto: 'https://example.com/foto.png',
      experienceSummary: '5 anos em cozinha italiana',
      averageRating: 4.5,
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListJobApplicantsUseCase(prisma as unknown as PrismaService);
  });

  it('lista os candidatos da vaga com o perfil público e a paginação', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.candidatura.findMany.mockResolvedValue([candidaturaRow]);
    prisma.candidatura.count.mockResolvedValue(1);

    const result = await useCase.execute({
      vagaId: VAGA_ID,
      restauranteId: RESTAURANTE_ID,
    });

    expect(result).toEqual({
      data: [
        {
          candidaturaId: 'candidatura-1',
          status: CandidaturaStatus.PENDENTE,
          dataCandidatura,
          profissional: {
            id: 'professional-1',
            nomeCompleto: 'Maria Souza',
            cargoPrincipal: 'Cozinheira',
            fotoPerfil: 'https://example.com/foto.png',
            resumoExperiencias: '5 anos em cozinha italiana',
            avaliacaoMedia: 4.5,
          },
        },
      ],
      total: 1,
      skip: 0,
      take: 20,
    });
  });

  it('ordena pelos candidatos mais recentes e aplica skip/take', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.candidatura.findMany.mockResolvedValue([]);
    prisma.candidatura.count.mockResolvedValue(0);

    const result = await useCase.execute({
      vagaId: VAGA_ID,
      restauranteId: RESTAURANTE_ID,
      skip: 10,
      take: 5,
    });

    expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: VAGA_ID },
        skip: 10,
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.skip).toBe(10);
    expect(result.take).toBe(5);
  });

  it('filtra por status quando o query param é informado', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.candidatura.findMany.mockResolvedValue([candidaturaRow]);
    prisma.candidatura.count.mockResolvedValue(1);

    await useCase.execute({
      vagaId: VAGA_ID,
      restauranteId: RESTAURANTE_ID,
      status: CandidaturaStatus.PENDENTE,
    });

    const where = { jobId: VAGA_ID, status: CandidaturaStatus.PENDENTE };
    expect(prisma.candidatura.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(prisma.candidatura.count).toHaveBeenCalledWith({ where });
  });

  it('lança 404 quando a vaga não existe', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ vagaId: VAGA_ID, restauranteId: RESTAURANTE_ID }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.candidatura.findMany).not.toHaveBeenCalled();
  });

  it('lança 404 quando a vaga foi excluída logicamente', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante,
      active: false,
      deletedAt: new Date(),
    });

    await expect(
      useCase.execute({ vagaId: VAGA_ID, restauranteId: RESTAURANTE_ID }),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança 403 quando a vaga pertence a outro restaurante', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante,
      restaurantId: 'outro-restaurante',
    });

    await expect(
      useCase.execute({ vagaId: VAGA_ID, restauranteId: RESTAURANTE_ID }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.candidatura.findMany).not.toHaveBeenCalled();
  });

  it('retorna lista vazia quando ninguém se candidatou', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.candidatura.findMany.mockResolvedValue([]);
    prisma.candidatura.count.mockResolvedValue(0);

    const result = await useCase.execute({
      vagaId: VAGA_ID,
      restauranteId: RESTAURANTE_ID,
    });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
