import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReviewUseCase } from './create-review.use-case';

const createMockPrisma = () => ({
  user: {
    findUnique: jest.fn(),
  },
  job: {
    findUnique: jest.fn(),
  },
  candidatura: {
    findFirst: jest.fn(),
  },
  avaliacao: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  professional: {
    update: jest.fn(),
  },
  restaurant: {
    update: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('CreateReviewUseCase', () => {
  let useCase: CreateReviewUseCase;
  let prisma: MockPrisma;

  const PROFESSIONAL_ID = 'professional-1';
  const RESTAURANT_ID = 'restaurant-1';
  const JOB_ID = 'job-1';

  const baseInput = {
    authorId: PROFESSIONAL_ID,
    jobId: JOB_ID,
    receiverId: RESTAURANT_ID,
    rating: 5,
    comment: 'Ótimo trabalho',
  };

  const activeProfessional = {
    id: PROFESSIONAL_ID,
    role: Role.PROFISSIONAL,
    active: true,
    deletedAt: null,
  };

  const activeRestaurant = {
    id: RESTAURANT_ID,
    role: Role.RESTAURANTE,
    active: true,
    deletedAt: null,
  };

  const openJob = {
    id: JOB_ID,
    restaurantId: RESTAURANT_ID,
    active: true,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new CreateReviewUseCase(prisma as unknown as PrismaService);
  });

  it('lança ForbiddenException quando o autor não existe', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.job.findUnique).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando o autor está inativo ou soft-deletado', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      ...activeProfessional,
      deletedAt: new Date(),
    });

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lança ForbiddenException quando o recebedor não existe', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.job.findUnique).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando o recebedor está inativo ou soft-deletado', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce({ ...activeRestaurant, active: false });

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lança NotFoundException quando a vaga não existe', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a vaga está inativa ou soft-deletada', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue({ ...openJob, active: false });

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lança ForbiddenException quando o profissional avalia alguém que não é o restaurante da vaga', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue({
      ...openJob,
      restaurantId: 'outro-restaurante',
    });

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando o restaurante avalia alguém que não é profissional', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeRestaurant)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);

    await expect(
      useCase.execute({
        ...baseInput,
        authorId: RESTAURANT_ID,
        receiverId: RESTAURANT_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando o restaurante tenta se autoavaliar', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeRestaurant)
      .mockResolvedValueOnce(activeProfessional);
    prisma.job.findUnique.mockResolvedValue({
      ...openJob,
      restaurantId: RESTAURANT_ID,
    });

    await expect(
      useCase.execute({
        ...baseInput,
        authorId: RESTAURANT_ID,
        receiverId: RESTAURANT_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lança ForbiddenException quando o restaurante avalia um profissional de uma vaga que não é sua', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeRestaurant)
      .mockResolvedValueOnce(activeProfessional);
    prisma.job.findUnique.mockResolvedValue({
      ...openJob,
      restaurantId: 'outro-restaurante',
    });

    await expect(
      useCase.execute({
        ...baseInput,
        authorId: RESTAURANT_ID,
        receiverId: PROFESSIONAL_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando não há candidatura aprovada entre as partes', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.avaliacao.create).not.toHaveBeenCalled();
  });

  it('cria a avaliação quando o profissional avalia o restaurante da vaga', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.avaliacao.create.mockResolvedValue({ id: 'avaliacao-1' });
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 4.0 } });

    const result = await useCase.execute(baseInput);

    expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
      where: {
        jobId: JOB_ID,
        professionalId: PROFESSIONAL_ID,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });
    expect(prisma.avaliacao.create).toHaveBeenCalledWith({
      data: {
        rating: baseInput.rating,
        comment: baseInput.comment,
        avaliadorRole: Role.PROFISSIONAL,
        professionalId: PROFESSIONAL_ID,
        restaurantId: RESTAURANT_ID,
        jobId: JOB_ID,
      },
    });
    expect(result).toEqual({ id: 'avaliacao-1' });
  });

  it('recalcula e grava averageRating do restaurant quando profissional avalia', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.avaliacao.create.mockResolvedValue({ id: 'avaliacao-1' });
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 4.5 } });

    await useCase.execute(baseInput);

    expect(prisma.avaliacao.aggregate).toHaveBeenCalledWith({
      where: { restaurantId: RESTAURANT_ID },
      _avg: { rating: true },
    });
    expect(prisma.restaurant.update).toHaveBeenCalledWith({
      where: { userId: RESTAURANT_ID },
      data: { averageRating: 4.5 },
    });
    expect(prisma.professional.update).not.toHaveBeenCalled();
  });

  it('recalcula e grava averageRating do professional quando restaurante avalia', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeRestaurant)
      .mockResolvedValueOnce(activeProfessional);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.avaliacao.create.mockResolvedValue({ id: 'avaliacao-1' });
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 4.0 } });

    await useCase.execute({
      ...baseInput,
      authorId: RESTAURANT_ID,
      receiverId: PROFESSIONAL_ID,
    });

    expect(prisma.avaliacao.aggregate).toHaveBeenCalledWith({
      where: { professionalId: PROFESSIONAL_ID },
      _avg: { rating: true },
    });
    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { userId: PROFESSIONAL_ID },
      data: { averageRating: 4.0 },
    });
    expect(prisma.restaurant.update).not.toHaveBeenCalled();
  });

  it('cria a avaliação quando o restaurante avalia o profissional da vaga', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeRestaurant)
      .mockResolvedValueOnce(activeProfessional);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.avaliacao.create.mockResolvedValue({ id: 'avaliacao-2' });
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 4.0 } });

    const input = {
      ...baseInput,
      authorId: RESTAURANT_ID,
      receiverId: PROFESSIONAL_ID,
    };

    await useCase.execute(input);

    expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
      where: {
        jobId: JOB_ID,
        professionalId: PROFESSIONAL_ID,
        status: CandidaturaStatus.APROVADA,
      },
      select: { id: true },
    });
    expect(prisma.avaliacao.create).toHaveBeenCalledWith({
      data: {
        rating: input.rating,
        comment: input.comment,
        avaliadorRole: Role.RESTAURANTE,
        professionalId: PROFESSIONAL_ID,
        restaurantId: RESTAURANT_ID,
        jobId: JOB_ID,
      },
    });
  });

  it('grava comment como null quando não informado', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.avaliacao.create.mockResolvedValue({ id: 'avaliacao-3' });
    prisma.avaliacao.aggregate.mockResolvedValue({ _avg: { rating: 4.0 } });

    const { comment, ...inputSemComment } = baseInput;

    await useCase.execute(inputSemComment);

    expect(prisma.avaliacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ comment: null }),
      }),
    );
  });

  it('lança ConflictException quando o autor já avaliou o mesmo recebedor na mesma vaga', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    prisma.avaliacao.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    await expect(useCase.execute(baseInput)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('repropaga erros inesperados do prisma ao criar a avaliação', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(activeProfessional)
      .mockResolvedValueOnce(activeRestaurant);
    prisma.job.findUnique.mockResolvedValue(openJob);
    prisma.candidatura.findFirst.mockResolvedValue({ id: 'candidatura-1' });
    const unexpectedError = new Error('conexão perdida');
    prisma.avaliacao.create.mockRejectedValue(unexpectedError);

    await expect(useCase.execute(baseInput)).rejects.toBe(unexpectedError);
  });
});
