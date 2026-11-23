import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendMessageUseCase } from './send-message.use-case';
import { AssertChatAccessUseCase } from './assert-chat-access';
import { JobEventNotifier } from '../job-event-notifier';

describe('SendMessageUseCase', () => {
  let useCase: SendMessageUseCase;
  let prisma: {
    message: { create: jest.Mock };
    job: { findUnique: jest.Mock };
    restaurant: { findUnique: jest.Mock };
    professional: { findUnique: jest.Mock };
  };
  let assertChatAccessMock: { execute: jest.Mock };
  let notifier: { newMessage: jest.Mock; safely: jest.Mock };

  // Conversa da vaga job-1 entre o restaurante rest-1 e o profissional prof-1.
  const conversation = {
    jobId: 'job-1',
    professionalId: 'prof-1',
    restaurantId: 'rest-1',
  };

  beforeEach(async () => {
    prisma = {
      message: { create: jest.fn() },
      job: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            restaurantId: 'rest-1',
            restaurant: { restaurantName: 'Maré Alta' },
            candidaturas: [
              {
                professionalId: 'prof-1',
                professional: { fullName: 'Marina Souza' },
              },
            ],
          }),
      },
      restaurant: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ restaurantName: 'Maré Alta' }),
      },
      professional: {
        findUnique: jest.fn().mockResolvedValue({ fullName: 'Marina Souza' }),
      },
    };
    assertChatAccessMock = {
      execute: jest.fn().mockResolvedValue(conversation),
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
    it('valida o acesso e grava a mensagem na conversa (vaga + profissional)', async () => {
      const mockMessage = {
        id: 'msg-1',
        jobId: 'job-1',
        professionalId: 'prof-1',
        senderId: 'rest-1',
        content: 'Hello',
        createdAt: new Date(),
      };
      prisma.message.create.mockResolvedValue(mockMessage);

      const result = await useCase.execute({
        jobId: 'job-1',
        senderId: 'rest-1',
        professionalId: 'prof-1',
        content: 'Hello',
      });

      expect(assertChatAccessMock.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'rest-1',
        professionalId: 'prof-1',
      });
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: {
          jobId: 'job-1',
          professionalId: 'prof-1',
          senderId: 'rest-1',
          content: 'Hello',
        },
        select: {
          id: true,
          jobId: true,
          professionalId: true,
          senderId: true,
          content: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(mockMessage);
    });

    describe('notificação de mensagem nova', () => {
      const send = (senderId: string, onlineUserIds?: Set<string>) => {
        prisma.message.create.mockResolvedValue({ id: 'msg-1' });
        return useCase.execute({
          jobId: 'job-1',
          senderId,
          professionalId: 'prof-1',
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

      it('mensagem do restaurante avisa SÓ o profissional da conversa', async () => {
        await send('rest-1');

        expect(notifier.newMessage).toHaveBeenCalledTimes(1);
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

      it('mensagem recusada pelo gate (403) não grava nem avisa ninguém', async () => {
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

    it('propaga o 404 do gate quando a vaga não existe', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new NotFoundException('Vaga não encontrada'),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', senderId: 'prof-1', content: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
