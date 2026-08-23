import { NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListAvaliacoesRecebidasUseCase } from './list-avaliacoes-recebidas.use-case';

const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
  },
  avaliacao: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ListAvaliacoesRecebidasUseCase', () => {
  let useCase: ListAvaliacoesRecebidasUseCase;
  let prisma: MockPrisma;

  const USUARIO_ID = 'user-1';
  const createdAt = new Date('2026-07-10T12:00:00Z');

  const avaliacaoRow = {
    id: 'avaliacao-1',
    nota: 5,
    comentario: 'Excelente profissional',
    avaliadorId: 'user-2',
    createdAt,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListAvaliacoesRecebidasUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it('lança NotFoundException quando o usuário não existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ usuarioId: USUARIO_ID }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.avaliacao.findMany).not.toHaveBeenCalled();
  });

  it('lista as avaliações recebidas com a média calculada via aggregate', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: USUARIO_ID });
    prisma.avaliacao.findMany.mockResolvedValue([avaliacaoRow]);
    prisma.avaliacao.count.mockResolvedValue(1);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { nota: 5 } });

    const result = await useCase.execute({ usuarioId: USUARIO_ID });

    expect(result).toEqual({
      data: [avaliacaoRow],
      total: 1,
      skip: 0,
      take: 20,
      mediaNotas: 5,
    });
  });

  it('busca somente as avaliações em que o usuário é o recebedor, ordenadas por mais recente', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: USUARIO_ID });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { nota: null } });

    await useCase.execute({ usuarioId: USUARIO_ID });

    const where = { avaliadoId: USUARIO_ID };
    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: { createdAt: 'desc' } }),
    );
    expect(prisma.avaliacao.count).toHaveBeenCalledWith({ where });
    expect(prisma.avaliacao.aggregate).toHaveBeenCalledWith({
      where,
      _avg: { nota: true },
    });
  });

  it('aplica skip/take informados na paginação', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: USUARIO_ID });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { nota: null } });

    const result = await useCase.execute({
      usuarioId: USUARIO_ID,
      skip: 10,
      take: 5,
    });

    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
    expect(result.skip).toBe(10);
    expect(result.take).toBe(5);
  });

  it('usa skip/take padrão quando não informados', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: USUARIO_ID });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { nota: null } });

    const result = await useCase.execute({ usuarioId: USUARIO_ID });

    expect(prisma.avaliacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('retorna média nula quando o usuário não tem avaliações', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: USUARIO_ID });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.avaliacao.count.mockResolvedValue(0);
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { nota: null } });

    const result = await useCase.execute({ usuarioId: USUARIO_ID });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.mediaNotas).toBeNull();
  });
});
