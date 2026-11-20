import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CandidaturaStatus, JobStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateApplicationStatusUseCase } from './update-application-status.use-case';

const createMockPrisma = () => ({
  candidatura: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('UpdateApplicationStatusUseCase', () => {
  let useCase: UpdateApplicationStatusUseCase;
  let prisma: MockPrisma;

  const RESTAURANTE_ID = 'restaurant-1';
  const VAGA_ID = 'job-1';
  const CANDIDATURA_ID = 'candidatura-1';

  const candidaturaPendente = {
    id: CANDIDATURA_ID,
    jobId: VAGA_ID,
    professionalId: 'professional-1',
    status: CandidaturaStatus.PENDENTE,
    createdAt: new Date('2026-07-10T12:00:00Z'),
    updatedAt: new Date('2026-07-10T12:00:00Z'),
    job: {
      restaurantId: RESTAURANTE_ID,
      deletedAt: null,
      status: JobStatus.ABERTA,
    },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new UpdateApplicationStatusUseCase(
      prisma as unknown as PrismaService,
    );
  });

  it.each([CandidaturaStatus.APROVADA, CandidaturaStatus.REJEITADA])(
    'lança 422 ao decidir (%s) candidatura de vaga encerrada',
    async (status) => {
      prisma.candidatura.findUnique.mockResolvedValue({
        ...candidaturaPendente,
        job: { ...candidaturaPendente.job, status: JobStatus.ENCERRADA },
      });

      await expect(
        useCase.execute({
          jobId: VAGA_ID,
          applicationId: CANDIDATURA_ID,
          restaurantId: RESTAURANTE_ID,
          status,
        }),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'Não é possível alterar candidaturas de uma vaga encerrada',
        ),
      );
      expect(prisma.candidatura.update).not.toHaveBeenCalled();
    },
  );

  it('vaga encerrada de outro restaurante continua dando 403 (não vaza o status)', async () => {
    prisma.candidatura.findUnique.mockResolvedValue({
      ...candidaturaPendente,
      job: {
        ...candidaturaPendente.job,
        restaurantId: 'outro-restaurante',
        status: JobStatus.ENCERRADA,
      },
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        applicationId: CANDIDATURA_ID,
        restaurantId: RESTAURANTE_ID,
        status: CandidaturaStatus.APROVADA,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('atualiza o status da candidatura quando o restaurante é o dono da vaga', async () => {
    prisma.candidatura.findUnique.mockResolvedValue(candidaturaPendente);
    const atualizada = {
      ...candidaturaPendente,
      status: CandidaturaStatus.APROVADA,
    };
    prisma.candidatura.update.mockResolvedValue(atualizada);

    const result = await useCase.execute({
      jobId: VAGA_ID,
      applicationId: CANDIDATURA_ID,
      restaurantId: RESTAURANTE_ID,
      status: CandidaturaStatus.APROVADA,
    });

    expect(prisma.candidatura.update).toHaveBeenCalledWith({
      where: { id: CANDIDATURA_ID },
      data: { status: CandidaturaStatus.APROVADA },
    });
    expect(result).toBe(atualizada);
  });

  it('lança 404 quando a candidatura não existe', async () => {
    prisma.candidatura.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        applicationId: CANDIDATURA_ID,
        restaurantId: RESTAURANTE_ID,
        status: CandidaturaStatus.APROVADA,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.candidatura.update).not.toHaveBeenCalled();
  });

  it('lança 404 quando a candidatura pertence a outra vaga', async () => {
    prisma.candidatura.findUnique.mockResolvedValue({
      ...candidaturaPendente,
      jobId: 'outra-vaga',
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        applicationId: CANDIDATURA_ID,
        restaurantId: RESTAURANTE_ID,
        status: CandidaturaStatus.APROVADA,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.candidatura.update).not.toHaveBeenCalled();
  });

  it('lança 404 quando a vaga foi excluída logicamente', async () => {
    prisma.candidatura.findUnique.mockResolvedValue({
      ...candidaturaPendente,
      job: { restaurantId: RESTAURANTE_ID, deletedAt: new Date() },
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        applicationId: CANDIDATURA_ID,
        restaurantId: RESTAURANTE_ID,
        status: CandidaturaStatus.APROVADA,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.candidatura.update).not.toHaveBeenCalled();
  });

  it('lança 403 quando a vaga pertence a outro restaurante', async () => {
    prisma.candidatura.findUnique.mockResolvedValue({
      ...candidaturaPendente,
      job: { restaurantId: 'outro-restaurante' },
    });

    await expect(
      useCase.execute({
        jobId: VAGA_ID,
        applicationId: CANDIDATURA_ID,
        restaurantId: RESTAURANTE_ID,
        status: CandidaturaStatus.APROVADA,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.candidatura.update).not.toHaveBeenCalled();
  });

  it.each([CandidaturaStatus.APROVADA, CandidaturaStatus.REJEITADA])(
    'lança 422 ao tentar reverter uma candidatura %s para PENDENTE',
    async (statusAtual) => {
      prisma.candidatura.findUnique.mockResolvedValue({
        ...candidaturaPendente,
        status: statusAtual,
      });

      await expect(
        useCase.execute({
          jobId: VAGA_ID,
          applicationId: CANDIDATURA_ID,
          restaurantId: RESTAURANTE_ID,
          status: CandidaturaStatus.PENDENTE,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.candidatura.update).not.toHaveBeenCalled();
    },
  );

  it('permite mover de PENDENTE para REJEITADA', async () => {
    prisma.candidatura.findUnique.mockResolvedValue(candidaturaPendente);
    const atualizada = {
      ...candidaturaPendente,
      status: CandidaturaStatus.REJEITADA,
    };
    prisma.candidatura.update.mockResolvedValue(atualizada);

    const result = await useCase.execute({
      jobId: VAGA_ID,
      applicationId: CANDIDATURA_ID,
      restaurantId: RESTAURANTE_ID,
      status: CandidaturaStatus.REJEITADA,
    });

    expect(result).toBe(atualizada);
  });
});
