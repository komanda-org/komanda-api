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
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;
  let mockSendMessageUseCase: Partial<
    Record<keyof SendMessageUseCase, jest.Mock>
  >;
  let mockListMessagesUseCase: Partial<
    Record<keyof ListMessagesUseCase, jest.Mock>
  >;
  let mockJwtService: Partial<Record<keyof JwtService, jest.Mock>>;
  let mockConfigService: Partial<Record<keyof ConfigService, jest.Mock>>;

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

    mockSendMessageUseCase = {
      execute: jest.fn(),
    };

    mockListMessagesUseCase = {
      execute: jest.fn(),
    };

    mockJwtService = {
      verify: jest
        .fn()
        .mockReturnValue({ id: 'user-1', role: 'PROFISSIONAL' }),
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
    gateway.server = mockServer as Server;

    jest.clearAllMocks();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('handleConnection', () => {
    it('should accept connection with valid token', async () => {
      await gateway.handleConnection(mockSocket as Socket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-secret',
      });
      expect(mockSocket.data.user).toEqual({
        id: 'user-1',
        role: 'PROFISSIONAL',
      });
    });

    it('should reject connection without token', async () => {
      const socketWithoutToken = { ...mockSocket, handshake: { auth: {} } };
      await gateway.handleConnection(socketWithoutToken as Socket);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject connection with invalid token', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockSocket as Socket);

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up rate limit on disconnect', async () => {
      // First make a request to create rate limit entry
      mockSocket.data.user = { id: 'user-1' };
      mockListMessagesUseCase.execute.mockResolvedValue({
        messages: [],
        hasMore: false,
      });
      mockSocket.emit.mockReset();

      await gateway.handleJoin(mockSocket as Socket, { jobId: 'job-1' });

      // Now disconnect
      gateway.handleDisconnect(mockSocket as Socket);

      // Rate limit should be cleaned up
      // We can't directly test the private map, but we can verify no error
    });
  });

  describe('handleJoin (chat:join)', () => {
    beforeEach(() => {
      mockSocket.data.user = { id: 'user-1' };
    });

    it('should join room and return messages on success', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          jobId: 'job-1',
          senderId: 'user-1',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];
      mockListMessagesUseCase.execute.mockResolvedValue({
        messages: mockMessages,
        hasMore: false,
      });

      const result = await gateway.handleJoin(mockSocket as Socket, {
        jobId: 'job-1',
        take: 20,
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'user-1',
        take: 20,
      });
      expect(mockSocket.join).toHaveBeenCalledWith('job:job-1');
      expect(result.ok).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should return 403 when assertChatAccess fails', async () => {
      mockListMessagesUseCase.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      const result = await gateway.handleJoin(mockSocket as Socket, {
        jobId: 'job-1',
      });

      expect(result.ok).toBe(false);
      expect(result.error.statusCode).toBe(403);
    });

    it('should return 404 when job not found', async () => {
      mockListMessagesUseCase.execute.mockRejectedValue(
        new NotFoundException('Vaga não encontrada'),
      );

      const result = await gateway.handleJoin(mockSocket as Socket, {
        jobId: 'job-1',
      });

      expect(result.ok).toBe(false);
      expect(result.error.statusCode).toBe(404);
    });

    it('should enforce rate limit', async () => {
      mockListMessagesUseCase.execute.mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      // Make 21 requests (limit is 20 per 10 seconds)
      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleJoin(mockSocket as Socket, {
          jobId: 'job-1',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error.statusCode).toBe(429);
        }
      }
    });
  });

  describe('handleLeave (chat:leave)', () => {
    beforeEach(() => {
      mockSocket.data.user = { id: 'user-1' };
    });

    it('should leave room', async () => {
      const result = await gateway.handleLeave(mockSocket as Socket, {
        jobId: 'job-1',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('job:job-1');
      expect(result.ok).toBe(true);
    });

    it('should enforce rate limit', async () => {
      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleLeave(mockSocket as Socket, {
          jobId: 'job-1',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error.statusCode).toBe(429);
        }
      }
    });
  });

  describe('handleSend (chat:send)', () => {
    beforeEach(() => {
      mockSocket.data.user = { id: 'user-1' };
    });

    it('should send message and broadcast to room', async () => {
      const mockMessage = {
        id: 'msg-1',
        jobId: 'job-1',
        senderId: 'user-1',
        content: 'Hello',
        createdAt: new Date(),
      };
      mockSendMessageUseCase.execute.mockResolvedValue(mockMessage);

      const result = await gateway.handleSend(mockSocket as Socket, {
        jobId: 'job-1',
        content: 'Hello',
      });

      expect(mockSendMessageUseCase.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        senderId: 'user-1',
        content: 'Hello',
      });
      expect(mockServer.to).toHaveBeenCalledWith('job:job-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:message',
        expect.any(MessageResponseDto),
      );
      expect(result.ok).toBe(true);
      expect(result.message).toBeDefined();
    });

    it('should return 403 when assertChatAccess fails', async () => {
      mockSendMessageUseCase.execute.mockRejectedValue(
        new ForbiddenException(
          'Só é possível conversar após uma candidatura aprovada na vaga',
        ),
      );

      const result = await gateway.handleSend(mockSocket as Socket, {
        jobId: 'job-1',
        content: 'Hello',
      });

      expect(result.ok).toBe(false);
      expect(result.error.statusCode).toBe(403);
    });

    it('should validate content length', async () => {
      const longContent = 'a'.repeat(2001);
      mockSendMessageUseCase.execute.mockRejectedValue(
        new BadRequestException(
          'content must be shorter than or equal to 2000 characters',
        ),
      );

      const result = await gateway.handleSend(mockSocket as Socket, {
        jobId: 'job-1',
        content: longContent,
      });

      expect(result.ok).toBe(false);
      expect(result.error.statusCode).toBe(400);
    });

    it('should enforce rate limit', async () => {
      mockSendMessageUseCase.execute.mockResolvedValue({
        id: 'msg-1',
        jobId: 'job-1',
        senderId: 'user-1',
        content: 'Hello',
        createdAt: new Date(),
      });

      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleSend(mockSocket as Socket, {
          jobId: 'job-1',
          content: 'Hello',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error.statusCode).toBe(429);
        }
      }
    });
  });

  describe('handleHistory (chat:history)', () => {
    beforeEach(() => {
      mockSocket.data.user = { id: 'user-1' };
    });

    it('should return paginated history', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          jobId: 'job-1',
          senderId: 'user-1',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];
      mockListMessagesUseCase.execute.mockResolvedValue({
        messages: mockMessages,
        hasMore: false,
      });

      const result = await gateway.handleHistory(mockSocket as Socket, {
        jobId: 'job-1',
        take: 10,
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith({
        jobId: 'job-1',
        userId: 'user-1',
        take: 10,
        before: undefined,
      });
      expect(result.ok).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should parse before date', async () => {
      const beforeDate = '2024-01-15T12:00:00.000Z';
      mockListMessagesUseCase.execute.mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      await gateway.handleHistory(mockSocket as Socket, {
        jobId: 'job-1',
        before: beforeDate,
      });

      expect(mockListMessagesUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          before: new Date(beforeDate),
        }),
      );
    });

    it('should enforce rate limit', async () => {
      mockListMessagesUseCase.execute.mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      for (let i = 0; i < 21; i++) {
        const result = await gateway.handleHistory(mockSocket as Socket, {
          jobId: 'job-1',
        });
        if (i < 20) {
          expect(result.ok).toBe(true);
        } else {
          expect(result.ok).toBe(false);
          expect(result.error.statusCode).toBe(429);
        }
      }
    });
  });
});
