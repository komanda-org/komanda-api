import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ThrottlerModule,
  ThrottlerStorage,
  ThrottlerStorageService,
} from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { io, Socket } from 'socket.io-client';
import { envValidationSchema } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { JobPostingsModule } from '../src/modules/job-postings/job-postings.module';
import { CandidaturaStatus, Role, JobStatus } from '@prisma/client';

describe('Messages WebSocket E2E', () => {
  let app: INestApplication;
  let prisma: Partial<Record<keyof PrismaService, jest.Mock>>;
  let jwtService: JwtService;
  let throttlerStorage: ThrottlerStorageService;
  let serverUrl: string;
  let httpServer: any;

  const mockUsers = {
    professional: {
      id: 'prof-1',
      email: 'prof@test.com',
      passwordHash: '',
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    },
    restaurant: {
      id: 'rest-1',
      email: 'rest@test.com',
      passwordHash: '',
      role: Role.RESTAURANTE,
      active: true,
      deletedAt: null,
    },
    otherProfessional: {
      id: 'prof-2',
      email: 'prof2@test.com',
      passwordHash: '',
      role: Role.PROFISSIONAL,
      active: true,
      deletedAt: null,
    },
  };

  const mockRestaurant = {
    userId: 'rest-1',
    restaurantName: 'Test Restaurant',
    cnpj: '12345678000199',
    cuisineType: 'Italiana',
    description: 'Test',
    address: 'Test Address',
    phone: '11999999999',
    zipCode: '01000-000',
    active: true,
    deletedAt: null,
    plan: 'FREE',
  };

  const mockJob = {
    id: 'job-1',
    title: 'Chef',
    description: 'Chef needed',
    requirements: 'Experience',
    salary: 5000,
    contractType: 'CLT',
    status: JobStatus.ABERTA,
    restaurantId: 'rest-1',
    active: true,
    deletedAt: null,
  };

  const mockProfessional = {
    userId: 'prof-1',
    fullName: 'John Doe',
    mainRole: 'Chef',
    interestedRoles: ['Chef'],
    active: true,
    deletedAt: null,
  };

  const mockApprovedApplication = {
    id: 'app-1',
    jobId: 'job-1',
    professionalId: 'prof-1',
    status: CandidaturaStatus.APROVADA,
  };

  beforeAll(async () => {
    process.env.AUTH_LOGIN_LIMIT = '100';
    process.env.AUTH_LOGIN_TTL_SECONDS = '60';

    const passwordHash = await bcrypt.hash('password', 10);
    mockUsers.professional.passwordHash = passwordHash;
    mockUsers.restaurant.passwordHash = passwordHash;
    mockUsers.otherProfessional.passwordHash = passwordHash;

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      restaurant: {
        findUnique: jest.fn(),
      },
      job: {
        findUnique: jest.fn(),
      },
      professional: {
        findUnique: jest.fn(),
      },
      candidatura: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
        }),
        ThrottlerModule.forRoot({
          throttlers: [
            {
              name: 'login',
              limit: Number(process.env.AUTH_LOGIN_LIMIT ?? 100),
              ttl: Number(process.env.AUTH_LOGIN_TTL_SECONDS ?? 60) * 1000,
            },
          ],
        }),
        AuthModule,
        JobPostingsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    throttlerStorage =
      moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0);
    httpServer = app.getHttpServer();
    serverUrl = `http://localhost:${httpServer.address().port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    throttlerStorage.storage.clear();
  });

  const createSocket = (token: string): Socket => {
    return io(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
  };

  const waitForAck = <T>(
    socket: Socket,
    event: string,
    data: any,
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timeout waiting for ${event} ack`)),
        5000,
      );
      socket.emit(event, data, (ack: T) => {
        clearTimeout(timeout);
        resolve(ack);
      });
    });
  };

  const waitForEvent = <T>(socket: Socket, event: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timeout waiting for ${event}`)),
        5000,
      );
      socket.once(event, (data: T) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });
  };

  const setupProfessionalSocket = async () => {
    const token = jwtService.sign({ id: 'prof-1', role: Role.PROFISSIONAL });
    prisma.user.findUnique.mockResolvedValue(mockUsers.professional);
    prisma.job.findUnique.mockResolvedValue(mockJob);
    prisma.candidatura.findFirst.mockResolvedValue(mockApprovedApplication);
    prisma.message.findMany.mockResolvedValue([]);

    const socket = createSocket(token);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Connection timeout')),
        5000,
      );
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Join first
    await waitForAck<any>(socket, 'chat:join', { jobId: 'job-1' });

    return socket;
  };

  describe('Connection', () => {
    it('should accept connection with valid token', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsers.professional);

      const token = jwtService.sign({ id: 'prof-1', role: Role.PROFISSIONAL });
      const socket = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket.on('connect', () => {
          clearTimeout(timeout);
          expect(socket.connected).toBe(true);
          socket.disconnect();
          resolve();
        });
        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should allow restaurant owner to connect', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUsers.restaurant);

      const token = jwtService.sign({ id: 'rest-1', role: Role.RESTAURANTE });
      const socket = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket.on('connect', () => {
          clearTimeout(timeout);
          expect(socket.connected).toBe(true);
          socket.disconnect();
          resolve();
        });
        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('chat:join', () => {
    it('should join room and return empty messages when no history', async () => {
      const socket = await setupProfessionalSocket();

      const ack = await waitForAck<any>(socket, 'chat:join', {
        jobId: 'job-1',
      });

      expect(ack.ok).toBe(true);
      expect(ack.messages).toEqual([]);
      expect(ack.hasMore).toBe(false);

      socket.disconnect();
    });

    it('should allow restaurant owner to join', async () => {
      const token = jwtService.sign({ id: 'rest-1', role: Role.RESTAURANTE });
      prisma.user.findUnique.mockResolvedValue(mockUsers.restaurant);
      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.candidatura.findFirst.mockResolvedValue(mockApprovedApplication);
      prisma.message.findMany.mockResolvedValue([]);

      const socket = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.emit('chat:join', { jobId: 'job-1' }, (ack: any) => {
            expect(ack.ok).toBe(true);
            expect(ack.messages).toEqual([]);
            expect(ack.hasMore).toBe(false);
            socket.disconnect();
            resolve();
          });
        });
        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    it('should return 404 for non-existent job', async () => {
      const socket = await setupProfessionalSocket();
      prisma.job.findUnique.mockResolvedValue(null);

      const ack = await waitForAck<any>(socket, 'chat:join', {
        jobId: 'non-existent',
      });

      expect(ack.ok).toBe(false);
      expect(ack.error.statusCode).toBe(404);

      socket.disconnect();
    });

    it('should return 403 when professional has no approved application', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.otherProfessional);
      prisma.job.findUnique.mockResolvedValue(mockJob);

      const token = jwtService.sign({ id: 'prof-2', role: Role.PROFISSIONAL });
      const socket = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.emit('chat:join', { jobId: 'job-1' }, (ack: any) => {
            expect(ack.ok).toBe(false);
            expect(ack.error.statusCode).toBe(403);
            expect(ack.error.message).toContain('candidatura aprovada');
            socket.disconnect();
            resolve();
          });
        });
        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('chat:send', () => {
    let socket: Socket;

    beforeEach(async () => {
      socket = await setupProfessionalSocket();
      prisma.message.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'msg-1',
          jobId: args.data.jobId,
          senderId: args.data.senderId,
          content: args.data.content,
          createdAt: new Date(),
        }),
      );
    });

    afterEach(() => {
      if (socket?.connected) {
        socket.disconnect();
      }
    });

    it('should send message and receive ack', async () => {
      const ack = await waitForAck<any>(socket, 'chat:send', {
        jobId: 'job-1',
        content: 'Hello!',
      });

      expect(ack.ok).toBe(true);
      expect(ack.message).toBeDefined();
      expect(ack.message.content).toBe('Hello!');
      expect(ack.message.senderId).toBe('prof-1');
    });

    it('should broadcast message to room (including sender)', async () => {
      // Ensure socket is connected and joined
      expect(socket.connected).toBe(true);

      // Listen for broadcast BEFORE sending
      const broadcastPromise = waitForEvent<any>(socket, 'chat:message');

      // Send message
      const ack = await waitForAck<any>(socket, 'chat:send', {
        jobId: 'job-1',
        content: 'Broadcast test',
      });

      expect(ack.ok).toBe(true);

      // Wait for broadcast with a reasonable timeout
      const broadcastMsg = await Promise.race([
        broadcastPromise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(new Error('Timeout waiting for chat:message broadcast')),
            10000,
          ),
        ),
      ]);

      expect(broadcastMsg.content).toBe('Broadcast test');
      expect(broadcastMsg.senderId).toBe('prof-1');
    });

    it('should return 403 when no approved application', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.otherProfessional);

      const token = jwtService.sign({ id: 'prof-2', role: Role.PROFISSIONAL });
      const socket2 = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket2.on('connect', () => {
          clearTimeout(timeout);
          // First join (will fail)
          socket2.emit('chat:join', { jobId: 'job-1' }, (joinAck: any) => {
            expect(joinAck.ok).toBe(false);
            expect(joinAck.error.statusCode).toBe(403);

            // Then try to send (should also fail)
            socket2.emit(
              'chat:send',
              { jobId: 'job-1', content: 'Should fail' },
              (sendAck: any) => {
                expect(sendAck.ok).toBe(false);
                expect(sendAck.error.statusCode).toBe(403);
                socket2.disconnect();
                resolve();
              },
            );
          });
        });
        socket2.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('chat:history', () => {
    let socket: Socket;

    beforeEach(async () => {
      socket = await setupProfessionalSocket();
    });

    afterEach(() => {
      if (socket?.connected) {
        socket.disconnect();
      }
    });

    it('should return paginated history in ascending order', async () => {
      const now = new Date();
      const messages = [
        {
          id: 'msg-1',
          jobId: 'job-1',
          senderId: 'prof-1',
          content: 'First',
          createdAt: new Date(now.getTime()),
        },
        {
          id: 'msg-2',
          jobId: 'job-1',
          senderId: 'rest-1',
          content: 'Second',
          createdAt: new Date(now.getTime() + 1000),
        },
        {
          id: 'msg-3',
          jobId: 'job-1',
          senderId: 'prof-1',
          content: 'Third',
          createdAt: new Date(now.getTime() + 2000),
        },
      ];

      prisma.message.findMany.mockResolvedValue([...messages].reverse()); // DB returns desc

      const ack = await waitForAck<any>(socket, 'chat:history', {
        jobId: 'job-1',
        take: 10,
      });

      expect(ack.ok).toBe(true);
      expect(ack.messages).toHaveLength(3);
      expect(ack.messages[0].content).toBe('First');
      expect(ack.messages[1].content).toBe('Second');
      expect(ack.messages[2].content).toBe('Third');
      expect(ack.hasMore).toBe(false);
    });

    it('should support pagination with before parameter', async () => {
      const now = new Date();
      // Create 60 messages
      const messages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg-${i + 1}`,
        jobId: 'job-1',
        senderId: i % 2 === 0 ? 'prof-1' : 'rest-1',
        content: `Message ${i + 1}`,
        createdAt: new Date(now.getTime() + i * 1000),
      }));

      // Return 51 messages (take + 1 = 51) to trigger hasMore
      // We want messages before msg-10, so we return msg-10 through msg-60 (51 messages)
      // DB returns desc: msg-60, msg-59, ..., msg-10
      // Use-case takes 51, slices to 50 (drops msg-10), reverses to asc: msg-11, msg-12, ..., msg-60
      prisma.message.findMany.mockResolvedValue(
        messages.slice(9, 60).reverse(),
      );

      const beforeDate = messages[9].createdAt.toISOString();

      const ack = await waitForAck<any>(socket, 'chat:history', {
        jobId: 'job-1',
        take: 50,
        before: beforeDate,
      });

      expect(ack.ok).toBe(true);
      expect(ack.messages).toHaveLength(50);
      expect(ack.hasMore).toBe(true);
      // First message should be msg-11 (msg-10 was dropped as the cursor)
      expect(ack.messages[0].id).toBe('msg-11');
      expect(ack.messages[49].id).toBe('msg-60');
    });

    it('should return 403 when no approved application', async () => {
      prisma.candidatura.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockUsers.otherProfessional);

      const token = jwtService.sign({ id: 'prof-2', role: Role.PROFISSIONAL });
      const socket2 = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket2.on('connect', () => {
          clearTimeout(timeout);
          socket2.emit('chat:history', { jobId: 'job-1' }, (ack: any) => {
            expect(ack.ok).toBe(false);
            expect(ack.error.statusCode).toBe(403);
            socket2.disconnect();
            resolve();
          });
        });
        socket2.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('chat:leave', () => {
    it('should leave room', async () => {
      const socket = await setupProfessionalSocket();

      const ack = await waitForAck<any>(socket, 'chat:leave', {
        jobId: 'job-1',
      });

      expect(ack.ok).toBe(true);
      socket.disconnect();
    });
  });

  describe('Reconnection', () => {
    it('should reconnect and join to get missing messages', async () => {
      const token = jwtService.sign({ id: 'prof-1', role: Role.PROFISSIONAL });
      prisma.user.findUnique.mockResolvedValue(mockUsers.professional);
      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.candidatura.findFirst.mockResolvedValue(mockApprovedApplication);

      // First connection
      const socket1 = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket1.on('connect', () => {
          clearTimeout(timeout);
          socket1.emit('chat:join', { jobId: 'job-1' }, (ack: any) => {
            expect(ack.ok).toBe(true);
            resolve();
          });
        });
        socket1.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // Disconnect
      socket1.disconnect();

      // Reconnect - new socket
      prisma.message.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          jobId: 'job-1',
          senderId: 'rest-1',
          content: 'Message while connected',
          createdAt: new Date(),
        },
      ]);

      const socket2 = createSocket(token);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Connection timeout')),
          5000,
        );
        socket2.on('connect', () => {
          clearTimeout(timeout);
          socket2.emit('chat:join', { jobId: 'job-1' }, (ack: any) => {
            expect(ack.ok).toBe(true);
            expect(ack.messages).toHaveLength(1);
            expect(ack.messages[0].content).toBe('Message while connected');
            socket2.disconnect();
            resolve();
          });
        });
        socket2.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });
});
