import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateJobPostingUseCase } from './update-job-posting.use-case';

const createMockPrisma = () => ({
  job: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('UpdateJobPostingUseCase', () => {
  let useCase: UpdateJobPostingUseCase;
  let prisma: MockPrisma;

  const RESTAURANTE_ID = 'restaurant-1';
  const VAGA_ID = 'job-1';
  const createdAt = new Date('2026-09-01T12:00:00Z');

  const vagaDoRestaurante = {
    restaurantId: RESTAURANTE_ID,
    status: JobStatus.ABERTA,
    active: true,
    deletedAt: null,
  };

  // Linha completa como o Prisma devolve no update.
  const vagaGravada = {
    id: VAGA_ID,
    title: 'Chef de Cozinha Sênior',
    description: 'Vaga para chef com experiência em cozinha italiana.',
    requirements: null,
    salary: new Prisma.Decimal(5000),
    contractType: ContractType.CLT,
    status: JobStatus.ABERTA,
    urgent: false,
    restaurantId: RESTAURANTE_ID,
    active: true,
    closedAt: null,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new UpdateJobPostingUseCase(prisma as unknown as PrismaService);
  });

  it('o dono edita a própria vaga e recebe a resposta pública', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.job.update.mockResolvedValue(vagaGravada);

    const result = await useCase.execute({
      jobId: VAGA_ID,
      restaurantId: RESTAURANTE_ID,
      changes: { title: 'Chef de Cozinha Sênior', salary: 5000 },
    });

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: VAGA_ID },
      data: expect.objectContaining({
        title: 'Chef de Cozinha Sênior',
        salary: 5000,
      }) as unknown,
    });
    expect(result).toEqual({
      id: VAGA_ID,
      title: 'Chef de Cozinha Sênior',
      description: vagaGravada.description,
      requirements: undefined,
      salary: 5000,
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      urgent: false,
      restaurantId: RESTAURANTE_ID,
      createdAt,
    });
  });

  it('permite marcar a vaga como urgente', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.job.update.mockResolvedValue({ ...vagaGravada, urgent: true });

    const result = await useCase.execute({
      jobId: VAGA_ID,
      restaurantId: RESTAURANTE_ID,
      changes: { urgent: true },
    });

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ urgent: true }) as unknown,
      }),
    );
    expect(result.urgent).toBe(true);
  });

  it('não altera status pela edição, mesmo com a vaga pausada', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante,
      status: JobStatus.PAUSADA,
    });
    prisma.job.update.mockResolvedValue({
      ...vagaGravada,
      status: JobStatus.PAUSADA,
    });

    await useCase.execute({
      jobId: VAGA_ID,
      restaurantId: RESTAURANTE_ID,
      changes: { title: 'Novo título da vaga' },
    });

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          status: expect.anything() as unknown,
        }) as unknown,
      }),
    );
  });

  it('trata null como campo não enviado (não manda null para coluna NOT NULL)', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaDoRestaurante);
    prisma.job.update.mockResolvedValue(vagaGravada);

    // Simula o body { "title": null } que passa pelo @IsOptional.
    const changes = { title: null } as unknown as { title: string };

    await useCase.execute({
      jobId: VAGA_ID,
      restaurantId: RESTAURANTE_ID,
      changes,
    });

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: undefined }) as unknown,
      }),
    );
  });

  it('lança 404 quando a vaga não existe', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        restaurantId: RESTAURANTE_ID,
        changes: { urgent: true },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('lança 404 quando a vaga foi excluída logicamente', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante,
      active: false,
      deletedAt: new Date(),
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        restaurantId: RESTAURANTE_ID,
        changes: { urgent: true },
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('lança 403 quando quem edita não é o dono da vaga', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante,
      restaurantId: 'outro-restaurante',
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        restaurantId: RESTAURANTE_ID,
        changes: { title: 'Tentativa de editar vaga alheia' },
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });

  it('lança 422 ao editar uma vaga encerrada', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaDoRestaurante,
      status: JobStatus.ENCERRADA,
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        restaurantId: RESTAURANTE_ID,
        changes: { title: 'Reabrindo pela edição' },
      }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(prisma.job.update).not.toHaveBeenCalled();
  });
});
