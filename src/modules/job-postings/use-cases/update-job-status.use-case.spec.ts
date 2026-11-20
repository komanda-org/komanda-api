import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CandidaturaStatus,
  ContractType,
  JobStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateJobStatusUseCase } from './update-job-status.use-case';

const createMockPrisma = () => ({
  job: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  candidatura: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  // Forma em lista: resolve as operações na ordem, como o Prisma.
  $transaction: jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  ),
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('UpdateJobStatusUseCase', () => {
  let useCase: UpdateJobStatusUseCase;
  let prisma: MockPrisma;

  const RESTAURANTE_ID = 'restaurant-1';
  const VAGA_ID = 'job-1';
  const createdAt = new Date('2026-09-01T12:00:00Z');

  const vagaDoRestaurante = (status: JobStatus) => ({
    restaurantId: RESTAURANTE_ID,
    status,
    active: true,
    deletedAt: null,
  });

  // Linha completa como o Prisma devolve no update.
  const vagaGravada = (status: JobStatus) => ({
    id: VAGA_ID,
    title: 'Chef de Cozinha',
    description: 'Vaga para chef com experiência em cozinha italiana.',
    requirements: null,
    salary: null,
    contractType: ContractType.CLT,
    status,
    urgent: false,
    restaurantId: RESTAURANTE_ID,
    active: true,
    closedAt: status === JobStatus.ENCERRADA ? new Date() : null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  });

  const executar = (status: JobStatus) =>
    useCase.execute({ jobId: VAGA_ID, restaurantId: RESTAURANTE_ID, status });

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new UpdateJobStatusUseCase(prisma as unknown as PrismaService);
  });

  it('percorre ABERTA → PAUSADA → ABERTA → ENCERRADA', async () => {
    const passos: [JobStatus, JobStatus][] = [
      [JobStatus.ABERTA, JobStatus.PAUSADA],
      [JobStatus.PAUSADA, JobStatus.ABERTA],
      [JobStatus.ABERTA, JobStatus.ENCERRADA],
    ];

    for (const [atual, proximo] of passos) {
      prisma.job.findUnique.mockResolvedValueOnce(vagaDoRestaurante(atual));
      prisma.job.update.mockResolvedValueOnce(vagaGravada(proximo));

      const result = await executar(proximo);

      expect(result.status).toBe(proximo);
      // O where carrega o status lido: é o que impede a corrida.
      expect(prisma.job.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { id: VAGA_ID, status: atual },
        }),
      );
    }
  });

  it('grava closedAt ao encerrar (RNF12)', async () => {
    prisma.job.findUnique.mockResolvedValue(
      vagaDoRestaurante(JobStatus.PAUSADA),
    );
    prisma.job.update.mockResolvedValue(vagaGravada(JobStatus.ENCERRADA));

    await executar(JobStatus.ENCERRADA);

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: JobStatus.ENCERRADA,
          closedAt: expect.any(Date) as unknown,
        },
      }),
    );
  });

  it('ao encerrar, recusa as candidaturas pendentes na mesma transação', async () => {
    prisma.job.findUnique.mockResolvedValue(
      vagaDoRestaurante(JobStatus.ABERTA),
    );
    prisma.job.update.mockResolvedValue(vagaGravada(JobStatus.ENCERRADA));
    prisma.candidatura.updateMany.mockResolvedValue({ count: 3 });

    const result = await executar(JobStatus.ENCERRADA);

    expect(prisma.candidatura.updateMany).toHaveBeenCalledWith({
      where: { jobId: VAGA_ID, status: CandidaturaStatus.PENDENTE },
      data: { status: CandidaturaStatus.REJEITADA },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(JobStatus.ENCERRADA);
  });

  it.each([JobStatus.PAUSADA, JobStatus.ABERTA])(
    'ao mudar para %s, não mexe nas candidaturas',
    async (status) => {
      const atual =
        status === JobStatus.PAUSADA ? JobStatus.ABERTA : JobStatus.PAUSADA;
      prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante(atual));
      prisma.job.update.mockResolvedValue(vagaGravada(status));

      await executar(status);

      expect(prisma.candidatura.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('409 ao encerrar não recusa ninguém (transação desfeita)', async () => {
    prisma.job.findUnique.mockResolvedValue(
      vagaDoRestaurante(JobStatus.ABERTA),
    );
    prisma.job.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(executar(JobStatus.ENCERRADA)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('não mexe em closedAt ao pausar ou reabrir', async () => {
    prisma.job.findUnique.mockResolvedValue(
      vagaDoRestaurante(JobStatus.ABERTA),
    );
    prisma.job.update.mockResolvedValue(vagaGravada(JobStatus.PAUSADA));

    await executar(JobStatus.PAUSADA);

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: JobStatus.PAUSADA } }),
    );
  });

  it.each([JobStatus.ABERTA, JobStatus.PAUSADA])(
    'lança 422 ao tentar sair de ENCERRADA para %s',
    async (destino) => {
      prisma.job.findUnique.mockResolvedValue(
        vagaDoRestaurante(JobStatus.ENCERRADA),
      );

      await expect(executar(destino)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.job.update).not.toHaveBeenCalled();
    },
  );

  it('lança 422 quando o status pedido é o mesmo do atual', async () => {
    prisma.job.findUnique.mockResolvedValue(
      vagaDoRestaurante(JobStatus.PAUSADA),
    );

    await expect(executar(JobStatus.PAUSADA)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('lança 404 quando a vaga não existe', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(executar(JobStatus.PAUSADA)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('lança 404 quando a vaga foi excluída logicamente', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante(JobStatus.ABERTA),
      active: false,
      deletedAt: new Date(),
    });

    await expect(executar(JobStatus.PAUSADA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança 403 quando a vaga pertence a outro restaurante', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante(JobStatus.ABERTA),
      restaurantId: 'outro-restaurante',
    });

    await expect(executar(JobStatus.ENCERRADA)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('converte P2025 (status mudou no meio do caminho) em 409', async () => {
    prisma.job.findUnique.mockResolvedValue(
      vagaDoRestaurante(JobStatus.ABERTA),
    );
    prisma.job.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('P2025', {
        code: 'P2025',
        clientVersion: '7.0.0',
      }),
    );

    await expect(executar(JobStatus.PAUSADA)).rejects.toThrow(
      ConflictException,
    );
  });
});
