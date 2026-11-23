import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { MessagesGateway } from './messages.gateway';
import { SendMessageUseCase } from './use-cases/send-message.use-case';
import { ListMessagesUseCase } from './use-cases/list-messages.use-case';
import { MessageResponseDto } from './dto/message-response.dto';

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let module: TestingModule;
  let mockServer: { to: jest.Mock; emit: jest.Mock };
  let mockSocket: {
    id: string;
    handshake: { auth: { token?: string } };
    data: Record<string, any>;
    join: jest.Mock;
    leave: jest.Mock;
    emit: jest.Mock;
    disconnect: jest.Mock;
  };
  let mockSendMessageUseCase: { execute: jest.Mock };
  let mockListMessagesUseCase: { execute: jest.Mock };
  let mockJwtService: { verify: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  const PROFESSIONAL = { id: 'prof-1', role: 'PROFISSIONAL' };
  const RESTAURANT = { id: 'rest-1', role: 'RESTAURANTE' };

  const socketFor = (user: { id: string; role: string }, id = 'socket-x') => ({
    ...mockSocket,
    id,
    data: { user },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
  });

  const message = (overrides: Record<string, unknown> = {}) => ({
    id: 'msg-1',
    jobId: 'job-1',
    professionalId: 'prof-1',
    senderId: 'prof-1',
    content: 'Hello',
    createdAt: new Date(),
    ...overrides,
  });

  const asSocket = (s: unknown) => s as Socket;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    mockSocket = {
      id: 'socket-1',
      handshake: { auth: { token: 'valid-token' } },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockSendMessageUseCase = { execute: jest.fn() };
    mockListMessagesUseCase = { execute: jest.fn() };
    mockJwtService = {
      verify: jest.fn().mockReturnValue(PROFESSIONAL),
    };
    mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    module = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        { provide: SendMessageUseCase, useValue: mockSendMessageUseCase },
        { provide: ListMessagesUseCase, useValue: mockListMessagesUseCase },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<MessagesGateway>(MessagesGateway);
    gateway.server = mockServer as unknown as Server;

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('handleConnection', () => {
    it('aceita conexão com token válido', async () => {
      await gateway.handleConnection(asSocket(mockSocket));

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
      expect(mockSocket.data.user).toEqual(PROFESSIONAL);
    });

    it('recusa conexão sem token', async () => {
      const socketWithoutToken = { ...mockSocket, handshake: { auth: {} } };
      await gateway.handleConnection(asSocket(socketWithoutToken));

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('recusa conexão com token inválido', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(asSocket(mockSocket));

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('sai das conversas e avisa a presença de quem ficou', async () => {
      const prof = socketFor(PROFESSIONAL, 's-prof');
      const rest = socketFor(RESTAURANT, 's-rest');
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [],
        hasMore: false,
      });
      await gateway.handleJoin(asSocket(prof), { jobId: 'job-1' });
      await gateway.handleJoin(asSocket(rest), {
        jobId: 'job-1',
        professionalId: 'prof-1',
      });
      mockServer.emit.mockClear();

      gateway.handleDisconnect(asSocket(prof));

      expect(mockServer.to).toHaveBeenCalledWith('chat:job-1:prof-1');
      expect(mockServer.emit).toHaveBeenCalledWith('chat:presence', {
        jobId: 'job-1',
        professionalId: 'prof-1',
        online: false,
      });
    });
  });

  describe('handleJoin (chat:join)', () => {
    it('profissional entra na própria conversa (ignora professionalId do cliente)', async () => {
      const prof = socketFor(PROFESSIONAL);
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [message()],
        hasMore: false,
      });

      const result = await gateway.handleJoin(asSocket(prof), {
        jobId: 'job-1',
        professionalId: 'prof-2',
        take: 20,
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'prof-1',
        professionalId: 'prof-1',
        take: 20,
      });
      expect(prof.join).toHaveBeenCalledWith('chat:job-1:prof-1');
      expect(result.ok).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages?.[0].professionalId).toBe('prof-1');
      expect(result.hasMore).toBe(false);
    });

    it('restaurante entra na conversa do profissional informado', async () => {
      const rest = socketFor(RESTAURANT);
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-2',
        messages: [],
        hasMore: false,
      });

      const result = await gateway.handleJoin(asSocket(rest), {
        jobId: 'job-1',
        professionalId: 'prof-2',
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'rest-1', professionalId: 'prof-2' }),
      );
      expect(rest.join).toHaveBeenCalledWith('chat:job-1:prof-2');
      expect(result.ok).toBe(true);
    });

    it('restaurante sem professionalId: chat:error 400 e não consulta nada', async () => {
      const rest = socketFor(RESTAURANT);

      const result = await gateway.handleJoin(asSocket(rest), {
        jobId: 'job-1',
      });

      const error = {
        statusCode: 400,
        message: 'professionalId é obrigatório',
      };
      expect(result).toEqual({ ok: false, error });
      expect(rest.emit).toHaveBeenCalledWith('chat:error', error);
      expect(rest.join).not.toHaveBeenCalled();
      expect(mockListMessagesUseCase.execute).not.toHaveBeenCalled();
    });

    it('emite presença online só para a sala da conversa quando o outro lado entra', async () => {
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [],
        hasMore: false,
      });

      await gateway.handleJoin(asSocket(socketFor(PROFESSIONAL)), {
        jobId: 'job-1',
      });
      expect(mockServer.emit).not.toHaveBeenCalled();

      await gateway.handleJoin(asSocket(socketFor(RESTAURANT)), {
        jobId: 'job-1',
        professionalId: 'prof-1',
      });

      expect(mockServer.to).toHaveBeenCalledWith('chat:job-1:prof-1');
      expect(mockServer.emit).toHaveBeenCalledWith('chat:presence', {
        jobId: 'job-1',
        professionalId: 'prof-1',
        online: true,
      });
    });

    it('outro aprovado da mesma vaga não conta como presença na conversa', async () => {
      mockListMessagesUseCase.execute
        .mockResolvedValueOnce({
          professionalId: 'prof-1',
          messages: [],
          hasMore: false,
        })
        .mockResolvedValueOnce({
          professionalId: 'prof-2',
          messages: [],
          hasMore: false,
        });

      await gateway.handleJoin(asSocket(socketFor(PROFESSIONAL)), {
        jobId: 'job-1',
      });
      await gateway.handleJoin(
        asSocket(socketFor({ id: 'prof-2', role: 'PROFISSIONAL' })),
        { jobId: 'job-1' },
      );

      expect(mockServer.emit).not.toHaveBeenCalled();
    });

    it('devolve 403 quando o gate recusa', async () => {
      mockListMessagesUseCase.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      const result = await gateway.handleJoin(
        asSocket(socketFor(PROFESSIONAL)),
        { jobId: 'job-1' },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.statusCode).toBe(403);
    });

    it('devolve 404 quando a vaga não existe', async () => {
      mockListMessagesUseCase.execute.mockRejectedValue(
        new NotFoundException('Vaga não encontrada'),
      );

      const result = await gateway.handleJoin(
        asSocket(socketFor(PROFESSIONAL)),
        { jobId: 'job-1' },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.statusCode).toBe(404);
    });

    it('aplica o rate limit', async () => {
      const prof = socketFor(PROFESSIONAL);
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [],
        hasMore: false,
      });

      // 21 requisições (limite: 20 a cada 10 segundos)
      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleJoin(asSocket(prof), {
          jobId: 'job-1',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error?.statusCode).toBe(429);
        }
      }
    });
  });

  describe('handleLeave (chat:leave)', () => {
    it('profissional sai da própria conversa', async () => {
      const prof = socketFor(PROFESSIONAL);

      const result = await gateway.handleLeave(asSocket(prof), {
        jobId: 'job-1',
      });

      expect(prof.leave).toHaveBeenCalledWith('chat:job-1:prof-1');
      expect(result.ok).toBe(true);
    });

    it('restaurante sai da conversa do profissional informado', async () => {
      const rest = socketFor(RESTAURANT);

      await gateway.handleLeave(asSocket(rest), {
        jobId: 'job-1',
        professionalId: 'prof-2',
      });

      expect(rest.leave).toHaveBeenCalledWith('chat:job-1:prof-2');
    });

    it('restaurante sem professionalId recebe 400', async () => {
      const rest = socketFor(RESTAURANT);

      const result = await gateway.handleLeave(asSocket(rest), {
        jobId: 'job-1',
      });

      expect(result.ok).toBe(false);
      expect(rest.leave).not.toHaveBeenCalled();
    });

    it('aplica o rate limit', async () => {
      const prof = socketFor(PROFESSIONAL);
      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleLeave(asSocket(prof), {
          jobId: 'job-1',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error?.statusCode).toBe(429);
        }
      }
    });
  });

  describe('handleSend (chat:send)', () => {
    it('grava e transmite só para a sala da conversa', async () => {
      const rest = socketFor(RESTAURANT);
      mockSendMessageUseCase.execute.mockResolvedValue(
        message({ professionalId: 'prof-2', senderId: 'rest-1' }),
      );

      const result = await gateway.handleSend(asSocket(rest), {
        jobId: 'job-1',
        professionalId: 'prof-2',
        content: 'Hello',
      });

      expect(mockSendMessageUseCase.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        senderId: 'rest-1',
        professionalId: 'prof-2',
        content: 'Hello',
        onlineUserIds: undefined,
      });
      expect(mockServer.to).toHaveBeenCalledWith('chat:job-1:prof-2');
      expect(mockServer.to).not.toHaveBeenCalledWith('chat:job-1:prof-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:message',
        expect.any(MessageResponseDto),
      );
      expect(result.ok).toBe(true);
      expect(result.message?.professionalId).toBe('prof-2');
    });

    it('passa a presença da conversa para não notificar quem está nela', async () => {
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [],
        hasMore: false,
      });
      const prof = socketFor(PROFESSIONAL);
      await gateway.handleJoin(asSocket(prof), { jobId: 'job-1' });
      mockSendMessageUseCase.execute.mockResolvedValue(message());

      await gateway.handleSend(asSocket(prof), {
        jobId: 'job-1',
        content: 'Hello',
      });

      const [[input]] = mockSendMessageUseCase.execute.mock.calls as [
        [{ onlineUserIds: Set<string> }],
      ];
      expect([...input.onlineUserIds]).toEqual(['prof-1']);
    });

    it('restaurante sem professionalId recebe 400 e nada é gravado', async () => {
      const rest = socketFor(RESTAURANT);

      const result = await gateway.handleSend(asSocket(rest), {
        jobId: 'job-1',
        content: 'Hello',
      });

      expect(result.ok).toBe(false);
      expect(result.error?.statusCode).toBe(400);
      expect(mockSendMessageUseCase.execute).not.toHaveBeenCalled();
    });

    it('devolve 403 quando o gate recusa', async () => {
      mockSendMessageUseCase.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      const result = await gateway.handleSend(
        asSocket(socketFor(PROFESSIONAL)),
        { jobId: 'job-1', content: 'Hello' },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.statusCode).toBe(403);
    });

    it('devolve 400 em erro de validação', async () => {
      mockSendMessageUseCase.execute.mockRejectedValue(
        new BadRequestException(
          'content must be shorter than or equal to 2000 characters',
        ),
      );

      const result = await gateway.handleSend(
        asSocket(socketFor(PROFESSIONAL)),
        { jobId: 'job-1', content: 'a'.repeat(2001) },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.statusCode).toBe(400);
    });

    it('aplica o rate limit', async () => {
      const prof = socketFor(PROFESSIONAL);
      mockSendMessageUseCase.execute.mockResolvedValue(message());

      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleSend(asSocket(prof), {
          jobId: 'job-1',
          content: 'Hello',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error?.statusCode).toBe(429);
        }
      }
    });
  });

  describe('handleHistory (chat:history)', () => {
    it('devolve o histórico paginado da conversa', async () => {
      const rest = socketFor(RESTAURANT);
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [message()],
        hasMore: false,
      });

      const result = await gateway.handleHistory(asSocket(rest), {
        jobId: 'job-1',
        professionalId: 'prof-1',
        take: 10,
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'rest-1',
        professionalId: 'prof-1',
        take: 10,
        before: undefined,
      });
      expect(result.ok).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('converte o before para Date', async () => {
      const beforeDate = '2024-01-15T12:00:00.000Z';
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [],
        hasMore: false,
      });

      await gateway.handleHistory(asSocket(socketFor(PROFESSIONAL)), {
        jobId: 'job-1',
        before: beforeDate,
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ before: new Date(beforeDate) }),
      );
    });

    it('restaurante sem professionalId recebe 400', async () => {
      const result = await gateway.handleHistory(
        asSocket(socketFor(RESTAURANT)),
        { jobId: 'job-1' },
      );

      expect(result.ok).toBe(false);
      expect(result.error?.statusCode).toBe(400);
      expect(mockListMessagesUseCase.execute).not.toHaveBeenCalled();
    });

    it('aplica o rate limit', async () => {
      const prof = socketFor(PROFESSIONAL);
      mockListMessagesUseCase.execute.mockResolvedValue({
        professionalId: 'prof-1',
        messages: [],
        hasMore: false,
      });

      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleHistory(asSocket(prof), {
          jobId: 'job-1',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error?.statusCode).toBe(429);
        }
      }
    });
  });
});
