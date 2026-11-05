import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMessagesUseCase } from './list-messages.use-case';
import { AssertChatAccessUseCase } from './assert-chat-access';

describe('ListMessagesUseCase', () => {
  let useCase: ListMessagesUseCase;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;
  let assertChatAccessMock: Partial<
    Record<keyof AssertChatAccessUseCase, jest.Mock>
  >;

  const createMockMessage = (
    overrides: Partial<{ id: string; createdAt: Date }> = {},
  ) => ({
    id: `msg-${overrides.id || '1'}`,
    jobId: 'job-1',
    senderId: 'user-1',
    content: `Message ${overrides.id || '1'}`,
    createdAt: overrides.createdAt || new Date(),
  });

  beforeEach(async () => {
    prisma = {
      message: {
        findMany: jest.fn(),
      },
    };

    assertChatAccessMock = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMessagesUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: AssertChatAccessUseCase, useValue: assertChatAccessMock },
      ],
    }).compile();

    useCase = module.get<ListMessagesUseCase>(ListMessagesUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should call assertChatAccess and return messages in ascending order', async () => {
      const now = new Date();
      const messages = [
        createMockMessage({
          id: '3',
          createdAt: new Date(now.getTime() + 2000),
        }),
        createMockMessage({
          id: '2',
          createdAt: new Date(now.getTime() + 1000),
        }),
        createMockMessage({ id: '1', createdAt: now }),
      ];

      assertChatAccessMock.execute.mockResolvedValue(undefined);
      prisma.message.findMany.mockResolvedValue(messages);

      const result = await useCase.execute({
        jobId: 'job-1',
        userId: 'user-1',
        take: 50,
      });

      expect(assertChatAccessMock.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'user-1',
      });
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job-1' },
        orderBy: { createdAt: 'desc' },
        take: 51,
        select: {
          id: true,
          jobId: true,
          senderId: true,
          content: true,
          createdAt: true,
        },
      });
      // Should return in ascending order (oldest first)
      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].id).toBe('msg-1');
      expect(result.messages[1].id).toBe('msg-2');
      expect(result.messages[2].id).toBe('msg-3');
      expect(result.hasMore).toBe(false);
    });

    it('should respect take limit and set hasMore', async () => {
      const now = new Date();
      // Create 51 messages (take + 1) to test hasMore
      // Messages are ordered with ID 1 = oldest, ID 51 = newest
      const messages = Array.from({ length: 51 }, (_, i) =>
        createMockMessage({
          id: String(i + 1),
          createdAt: new Date(now.getTime() + i * 1000),
        }),
      );

      // Database query uses orderBy: { createdAt: 'desc' }, so it returns newest first
      const messagesDesc = [...messages].reverse();

      assertChatAccessMock.execute.mockResolvedValue(undefined);
      prisma.message.findMany.mockResolvedValue(messagesDesc);

      const result = await useCase.execute({
        jobId: 'job-1',
        userId: 'user-1',
        take: 50,
      });

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
      // Query is desc (newest first), takes 51, slices to 50 (drops oldest = msg-1),
      // then reverses to ascending. So first should be msg-2, last should be msg-51.
      expect(result.messages[0].id).toBe('msg-2');
      expect(result.messages[49].id).toBe('msg-51');
    });

    it('should use default take of 50 when not provided', async () => {
      assertChatAccessMock.execute.mockResolvedValue(undefined);
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({
        jobId: 'job-1',
        userId: 'user-1',
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });

    it('should cap take at 100', async () => {
      assertChatAccessMock.execute.mockResolvedValue(undefined);
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({
        jobId: 'job-1',
        userId: 'user-1',
        take: 200,
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 }),
      );
    });

    it('should filter by before date', async () => {
      const beforeDate = new Date('2024-01-15T12:00:00Z');
      assertChatAccessMock.execute.mockResolvedValue(undefined);
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({
        jobId: 'job-1',
        userId: 'user-1',
        before: beforeDate,
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            jobId: 'job-1',
            createdAt: { lt: beforeDate },
          },
        }),
      );
    });

    it('should propagate 403 from assertChatAccess', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      await expect(
        useCase.execute({
          jobId: 'job-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate 404 from assertChatAccess', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new NotFoundException('Vaga não encontrada'),
      );

      await expect(
        useCase.execute({
          jobId: 'job-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
