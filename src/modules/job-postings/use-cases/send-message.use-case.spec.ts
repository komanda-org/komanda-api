import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMessageUseCase } from './send-message.use-case';
import { AssertChatAccessUseCase } from './assert-chat-access';

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;
  let assertChatAccessMock: Partial<
    Record<keyof AssertChatAccessUseCase, jest.Mock>
  >;

  beforeEach(async () => {
    prisma = {
      message: {
        create: jest.fn(),
      },
    };

    assertChatAccessMock = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendMessageUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: AssertChatAccessUseCase, useValue: assertChatAccessMock },
      ],
    }).compile();

    useCase = module.get<SendMessageUseCase>(SendMessageUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should call assertChatAccess and create message', async () => {
      const mockMessage = {
        id: 'msg-1',
        jobId: 'job-1',
        senderId: 'user-1',
        content: 'Hello',
        createdAt: new Date(),
      };

      assertChatAccessMock.execute.mockResolvedValue(undefined);
      prisma.message.create.mockResolvedValue(mockMessage);

      const result = await useCase.execute({
        jobId: 'job-1',
        senderId: 'user-1',
        content: 'Hello',
      });

      expect(assertChatAccessMock.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'user-1',
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          jobId: 'job-1',
          senderId: 'user-1',
          content: 'Hello',
        },
        select: {
          id: true,
          jobId: true,
          senderId: true,
          content: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockMessage);
    });

    it('should propagate 403 from assertChatAccess when user not allowed', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      await expect(
        useCase.execute({
          jobId: 'job-1',
          senderId: 'user-1',
          content: 'Hello',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate 404 from assertChatAccess when job not found', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new NotFoundException('Vaga não encontrada'),
      );

      await expect(
        useCase.execute({
          jobId: 'job-1',
          senderId: 'user-1',
          content: 'Hello',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
