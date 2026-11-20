import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssertChatAccessUseCase } from './assert-chat-access';

describe('AssertChatAccessUseCase', () => {
  let useCase: AssertChatAccessUseCase;
  let prisma: {
    user: { findUnique: jest.Mock };
    job: { findUnique: jest.Mock };
    candidatura: { findFirst: jest.Mock };
  };

  const mockUser = (
    overrides: Partial<{
      id: string;
      active: boolean;
      deletedAt: Date | null;
    }> = {},
  ) => ({
    id: 'user-1',
    active: true,
    deletedAt: null,
    ...overrides,
  });

  const mockJob = (
    overrides: Partial<{
      id: string;
      restaurantId: string;
      active: boolean;
      deletedAt: Date | null;
    }> = {},
  ) => ({
    id: 'job-1',
    restaurantId: 'restaurant-1',
    active: true,
    deletedAt: null,
    ...overrides,
  });

  const approved = { id: 'candidatura-1', status: CandidaturaStatus.APROVADA };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      job: { findUnique: jest.fn() },
      candidatura: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssertChatAccessUseCase,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get<AssertChatAccessUseCase>(AssertChatAccessUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('conta e vaga', () => {
    it('403 quando o usuário não existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('403 quando o usuário está inativo', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ active: false }));

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('403 quando o usuário foi excluído', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({ deletedAt: new Date() }),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it.each([
      ['não existe', null],
      ['está inativa', mockJob({ active: false })],
      ['foi excluída', mockJob({ deletedAt: new Date() })],
    ])('404 quando a vaga %s', async (_caso, job) => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(job);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('restaurante dono da vaga', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ id: 'rest-1' }));
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'rest-1' }),
      );
    });

    it('libera a conversa com um profissional aprovado', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(approved);

      await expect(
        useCase.execute({
          jobId: 'job-1',
          userId: 'rest-1',
          professionalId: 'prof-1',
        }),
      ).resolves.toEqual({
        jobId: 'job-1',
        professionalId: 'prof-1',
        restaurantId: 'rest-1',
      });
      expect(prisma.candidatura.findFirst).toHaveBeenCalledWith({
        where: {
          jobId: 'job-1',
          professionalId: 'prof-1',
          status: CandidaturaStatus.APROVADA,
        },
        select: { id: true },
      });
    });

    it('403 com professionalId que não foi aprovado na vaga', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute({
          jobId: 'job-1',
          userId: 'rest-1',
          professionalId: 'prof-2',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('400 sem professionalId (a vaga pode ter vários aprovados)', async () => {
      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'rest-1' }),
      ).rejects.toThrow(
        new BadRequestException('professionalId é obrigatório'),
      );
      expect(prisma.candidatura.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('profissional', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ id: 'prof-1' }));
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'rest-1' }),
      );
    });

    it('libera a própria conversa quando está aprovado', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(approved);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'prof-1' }),
      ).resolves.toEqual({
        jobId: 'job-1',
        professionalId: 'prof-1',
        restaurantId: 'rest-1',
      });
    });

    it('ignora professionalId de outra pessoa e usa o próprio id', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(approved);

      const conversation = await useCase.execute({
        jobId: 'job-1',
        userId: 'prof-1',
        professionalId: 'prof-2',
      });

      expect(conversation.professionalId).toBe('prof-1');
      const [[args]] = prisma.candidatura.findFirst.mock.calls as [
        [{ where: { professionalId: string } }],
      ];
      expect(args.where.professionalId).toBe('prof-1');
    });

    it('403 sem candidatura aprovada (pendente, rejeitada ou inexistente)', async () => {
      // findFirst filtra por APROVADA: pendente/rejeitada voltam null
      prisma.candidatura.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'prof-1' }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );
    });
  });

  it('restaurante que não é dono da vaga recebe 403', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser({ id: 'rest-2' }));
    prisma.job.findUnique.mockResolvedValue(
      mockJob({ restaurantId: 'rest-1' }),
    );
    prisma.candidatura.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({
        jobId: 'job-1',
        userId: 'rest-2',
        professionalId: 'prof-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
