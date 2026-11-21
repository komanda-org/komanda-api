import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListMessagesUseCase } from './list-messages.use-case';
import { AssertChatAccessUseCase } from './assert-chat-access';
import { CHAT_MESSAGE_SELECT } from '../dto/message-response.dto';

describe('ListMessagesUseCase', () => {
  let useCase: ListMessagesUseCase;
  let prisma: { message: { findMany: jest.Mock } };
  let assertChatAccessMock: { execute: jest.Mock };

  const conversation = {
    jobId: 'job-1',
    professionalId: 'prof-1',
    restaurantId: 'rest-1',
  };

  const createMockMessage = (
    overrides: Partial<{ id: string; createdAt: Date }> = {},
  ) => ({
    id: `msg-${overrides.id || '1'}`,
    jobId: 'job-1',
    professionalId: 'prof-1',
    senderId: 'prof-1',
    content: `Message ${overrides.id || '1'}`,
    createdAt: overrides.createdAt || new Date(),
  });

  beforeEach(async () => {
    prisma = { message: { findMany: jest.fn() } };
    assertChatAccessMock = {
      execute: jest.fn().mockResolvedValue(conversation),
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
    it('valida o acesso, filtra pela conversa (vaga + profissional) e devolve em ordem crescente', async () => {
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
      prisma.message.findMany.mockResolvedValue(messages);

      const result = await useCase.execute({
        jobId: 'job-1',
        userId: 'rest-1',
        professionalId: 'prof-1',
        take: 50,
      });

      expect(assertChatAccessMock.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'rest-1',
        professionalId: 'prof-1',
      });
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { jobId: 'job-1', professionalId: 'prof-1' },
        orderBy: { createdAt: 'desc' },
        take: 51,
        select: CHAT_MESSAGE_SELECT,
      });
      expect(result.professionalId).toBe('prof-1');
      expect(result.messages.map((m) => m.id)).toEqual([
        'msg-1',
        'msg-2',
        'msg-3',
      ]);
      expect(result.hasMore).toBe(false);
    });

    it('usa o professionalId resolvido pelo gate, não o enviado pelo cliente', async () => {
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({
        jobId: 'job-1',
        userId: 'prof-1',
        professionalId: 'prof-2',
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: 'job-1', professionalId: 'prof-1' },
        }),
      );
    });

    it('respeita o take e marca hasMore', async () => {
      const now = new Date();
      // Mensagens com ID 1 = mais antiga, ID 51 = mais nova
      const messages = Array.from({ length: 51 }, (_, i) =>
        createMockMessage({
          id: String(i + 1),
          createdAt: new Date(now.getTime() + i * 1000),
        }),
      );
      // A query usa orderBy desc: vem a mais nova primeiro
      prisma.message.findMany.mockResolvedValue([...messages].reverse());

      const result = await useCase.execute({
        jobId: 'job-1',
        userId: 'prof-1',
        take: 50,
      });

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
      // Pega 51, corta para 50 (sai a msg-1, a mais antiga) e inverte.
      expect(result.messages[0].id).toBe('msg-2');
      expect(result.messages[49].id).toBe('msg-51');
    });

    it('take padrão é 50', async () => {
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({ jobId: 'job-1', userId: 'prof-1' });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 51 }),
      );
    });

    it('take máximo é 100', async () => {
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({ jobId: 'job-1', userId: 'prof-1', take: 200 });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 }),
      );
    });

    it('filtra por before', async () => {
      const beforeDate = new Date('2024-01-15T12:00:00Z');
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({
        jobId: 'job-1',
        userId: 'prof-1',
        before: beforeDate,
      });

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            jobId: 'job-1',
            professionalId: 'prof-1',
            createdAt: { lt: beforeDate },
          },
        }),
      );
    });

    it('propaga o 403 do gate sem consultar mensagens', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'prof-1' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });

    it('propaga o 404 do gate', async () => {
      assertChatAccessMock.execute.mockRejectedValue(
        new NotFoundException('Vaga não encontrada'),
      );

      await expect(
        useCase.execute({ jobId: 'job-1', userId: 'prof-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
