import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMessageUseCase } from './send-message.use-case';
import { AssertChatAccessUseCase } from './assert-chat-access';
import { JobEventNotifier } from '../job-event-notifier';

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;
  let assertChatAccessMock: Partial<
    Record<keyof AssertChatAccessUseCase, jest.Mock>
  >;
  let notifier: { newMessage: jest.Mock; safely: jest.Mock };

  // Vaga com o restaurante e os profissionais aprovados (quem está na conversa).
  const jobWithChat = {
    restaurantId: 'rest-1',
    restaurant: { restaurantName: 'Maré Alta' },
    candidaturas: [
      { professionalId: 'prof-1', professional: { fullName: 'Marina Souza' } },
    ],
  };

  beforeEach(async () => {
    prisma = {
      message: {
        create: jest.fn(),
      },
      job: {
        findUnique: jest.fn().mockResolvedValue(jobWithChat),
      },
    };

    assertChatAccessMock = {
      execute: jest.fn(),
    };

    notifier = {
      newMessage: jest.fn().mockResolvedValue(undefined),
      safely: jest.fn((_what: string, send: () => Promise<unknown>) => send()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendMessageUseCase,
        { provide: PrismaService, useValue: prisma },
        { provide: AssertChatAccessUseCase, useValue: assertChatAccessMock },
        { provide: JobEventNotifier, useValue: notifier },
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

    describe('notificação de mensagem nova', () => {
      const send = (senderId: string, onlineUserIds?: Set<string>) => {
        assertChatAccessMock.execute.mockResolvedValue(undefined);
        prisma.message.create.mockResolvedValue({ id: 'msg-1' });
        return useCase.execute({
          jobId: 'job-1',
          senderId,
          content: 'Pode começar segunda?',
          onlineUserIds,
        });
      };

      it('mensagem do profissional avisa o restaurante', async () => {
        await send('prof-1');

        expect(notifier.newMessage).toHaveBeenCalledWith({
          recipientIds: ['rest-1'],
          senderName: 'Marina Souza',
          content: 'Pode começar segunda?',
        });
      });

      it('mensagem do restaurante avisa os profissionais aprovados', async () => {
        await send('rest-1');

        expect(notifier.newMessage).toHaveBeenCalledWith({
          recipientIds: ['prof-1'],
          senderName: 'Maré Alta',
          content: 'Pode começar segunda?',
        });
      });

      it('não avisa quem está com a conversa aberta', async () => {
        await send('rest-1', new Set(['rest-1', 'prof-1']));

        expect(notifier.newMessage).not.toHaveBeenCalled();
      });

      it('mensagem recusada pelo gate (403) não avisa ninguém', async () => {
        assertChatAccessMock.execute.mockRejectedValue(
          new ForbiddenException('sem acesso'),
        );

        await expect(
          useCase.execute({ jobId: 'job-1', senderId: 'x', content: 'oi' }),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(notifier.newMessage).not.toHaveBeenCalled();
      });
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
