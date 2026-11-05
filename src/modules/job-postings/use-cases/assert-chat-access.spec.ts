import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CandidaturaStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssertChatAccessUseCase } from './assert-chat-access';

describe('AssertChatAccessUseCase', () => {
  let useCase: AssertChatAccessUseCase;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;

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

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      job: {
        findUnique: jest.fn(),
      },
      candidatura: {
        findFirst: jest.fn(),
      },
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

  describe('execute', () => {
    it('should throw 403 when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 403 when user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ active: false }));

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 403 when user is soft-deleted', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({ deletedAt: new Date() }),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 404 when job does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 when job is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(mockJob({ active: false }));

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 when job is soft-deleted', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ deletedAt: new Date() }),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow access when user is the restaurant owner', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'user-1' }),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).resolves.not.toThrow();
    });

    it('should throw 403 when professional has no approved application', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'restaurant-1' }),
      );
      prisma.candidatura.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 403 when professional has PENDENTE application', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'restaurant-1' }),
      );
      // findFirst filters for APROVADA, so PENDENTE returns null
      prisma.candidatura.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw 403 when professional has REJEITADA application', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'restaurant-1' }),
      );
      // findFirst filters for APROVADA, so REJEITADA returns null
      prisma.candidatura.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access when professional has APROVADA application', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'restaurant-1' }),
      );
      prisma.candidatura.findFirst.mockResolvedValue({
        id: 'candidatura-1',
        status: CandidaturaStatus.APROVADA,
      });

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'user-1' }),
      ).resolves.not.toThrow();
    });

    it('should throw 403 when professional tries to access another job', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.job.findUnique.mockResolvedValue(
        mockJob({ restaurantId: 'restaurant-1' }),
      );
      prisma.candidatura.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute({ jobId: 'other-job', userId: 'user-1' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
