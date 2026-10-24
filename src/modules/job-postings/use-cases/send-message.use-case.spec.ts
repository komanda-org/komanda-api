import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CandidaturaStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMessageUseCase } from './send-message.use-case';

const createMockPrisma = () => ({
  job: {
    findUnique: jest.fn(),
  },
  candidatura: {
    findFirst: jest.fn(),
  },
  message: {
    create: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
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
    senderId: PROFESSIONAL_ID,
    senderRole: Role.PROFISSIONAL,
    content: 'Olá, tudo bem?',
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new SendMessageUseCase(prisma as unknown as PrismaService);
  });

  it('lança NotFoundException quando a vaga não existe', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
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
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando restaurante não é dono da vaga', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...baseInput,
        senderId: OTHER_RESTAURANT_ID,
        senderRole: Role.RESTAURANTE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando restaurante é dono mas não há candidatura aprovada', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...baseInput,
        senderId: RESTAURANT_ID,
        senderRole: Role.RESTAURANTE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('cria a mensagem quando o profissional tem candidatura aprovada', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.message.create.mockResolvedValue({ id: 'message-1' });

    const result = await useCase.execute(baseInput);

    expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
      where: {
        jobId: JOB_ID,
        professionalId: PROFESSIONAL_ID,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        jobId: JOB_ID,
        senderId: PROFESSIONAL_ID,
        content: baseInput.content,
      },
    });
    expect(result).toEqual({ id: 'message-1' });
  });

  it('cria a mensagem quando o restaurante dono da vaga tem candidatura aprovada', async () => {
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.message.create.mockResolvedValue({ id: 'message-2' });

    const input = {
      ...baseInput,
      senderId: RESTAURANT_ID,
      senderRole: Role.RESTAURANTE,
    };

    await useCase.execute(input);

    expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
      where: { jobId: JOB_ID, status: CandidaturaStatus.APROVADA },
      select: { id: true },
    });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        jobId: JOB_ID,
        senderId: RESTAURANT_ID,
        content: input.content,
      },
    });
  });
});
