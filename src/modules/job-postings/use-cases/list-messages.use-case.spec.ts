import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CandidaturaStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMessagesUseCase } from './list-messages.use-case';

const createMockPrisma = () => ({
  job: {
    findUnique: jest.fn(),
  },
  candidatura: {
    findFirst: jest.fn(),
  },
  message: {
    findMany: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('ListMessagesUseCase', () => {
  let useCase: ListMessagesUseCase;
  let prisma: MockPrisma;

  const PROFESSIONAL_ID = 'professional-1';
  const RESTAURANT_ID = 'restaurant-1';
  const JOB_ID = 'job-1';
  const OTHER_RESTAURANT_ID = 'outro-restaurante';

  const openJob = {
    id: JOB_ID,
    restaurantId: RESTAURANT_ID,
    active: true,
    deletedAt: null,
  };

  const baseInput = {
    jobId: JOB_ID,
    userId: PROFESSIONAL_ID,
    userRole: Role.PROFISSIONAL,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListMessagesUseCase(prisma as unknown as PrismaService);
  });

  it('lança NotFoundException quando a vaga não existe', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a vaga está inativa ou soft-deletada', async () => {
    prisma.job.findUnique.mockResolvedValue({ ...openJob, active: false });

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando profissional não tem candidatura aprovada na vaga', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando restaurante não é dono da vaga', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...baseInput,
        userId: OTHER_RESTAURANT_ID,
        userRole: Role.RESTAURANTE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando restaurante é dono mas não há candidatura aprovada', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...baseInput,
        userId: RESTAURANT_ID,
        userRole: Role.RESTAURANTE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('lista mensagens em ordem cronológica ascendente para o profissional', async () => {
    const mensagens = [
      { id: 'message-1', createdAt: new Date('2026-01-01T10:00:00Z') },
      { id: 'message-2', createdAt: new Date('2026-01-01T10:05:00Z') },
    ];
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.message.findMany.mockResolvedValue(mensagens);

    const result = await useCase.execute(baseInput);

    expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
      where: {
        jobId: JOB_ID,
        professionalId: PROFESSIONAL_ID,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { jobId: JOB_ID },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual(mensagens);
  });

  it('lista mensagens em ordem cronológica ascendente para o restaurante dono', async () => {
    const mensagens = [
      { id: 'message-1', createdAt: new Date('2026-01-01T10:00:00Z') },
    ];
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.message.findMany.mockResolvedValue(mensagens);

    const input = {
      ...baseInput,
      userId: RESTAURANT_ID,
      userRole: Role.RESTAURANTE,
    };

    const result = await useCase.execute(input);

    expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
      where: { jobId: JOB_ID, status: CandidaturaStatus.APROVADA },
      select: { id: true },
    });
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { jobId: JOB_ID },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual(mensagens);
  });
});
