import { CandidaturaStatus, Role } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { ListUserChatsUseCase } from './list-user-chats.use-case';

const createMockPrisma = () => ({
  job: { findMany: jest.fn() },
  candidatura: { findMany: jest.fn() },
  message: { findMany: jest.fn() },
});

type FindManyArgs = { where: Record<string, unknown> };

describe('ListUserChatsUseCase', () => {
  let useCase: ListUserChatsUseCase;
  let prisma: ReturnType<typeof createMockPrisma>;

  const at = (iso: string) => new Date(iso);

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new ListUserChatsUseCase(prisma as unknown as PrismaService);
  });

  const firstArgs = (mock: jest.Mock): FindManyArgs =>
    (mock.mock.calls as FindManyArgs[][])[0][0];

  describe('restaurante', () => {
    it('com 2 aprovados na mesma vaga devolve 2 conversas, cada uma com a sua última mensagem', async () => {
      prisma.job.findMany.mockResolvedValue([
        {
          id: 'job-1',
          title: 'Garçom',
          candidaturas: [
            { professionalId: 'prof-2', professional: { fullName: 'Carlos Menezes', profilePhoto: 'p.png' } },
            { professionalId: 'prof-1', professional: { fullName: 'Marina Souza', profilePhoto: null } },
          ],
        },
      ]);
      // distinct por (jobId, professionalId): a última de cada conversa
      prisma.message.findMany.mockResolvedValue([
        {
          jobId: 'job-1',
          professionalId: 'prof-2',
          content: 'Fechado, Carlos!',
          createdAt: at('2026-11-20T12:00:00Z'),
        },
        {
          jobId: 'job-1',
          professionalId: 'prof-1',
          content: 'Oi Marina',
          createdAt: at('2026-11-19T12:00:00Z'),
        },
      ]);

      const chats = await useCase.execute({
        userId: 'rest-1',
        userRole: Role.RESTAURANTE,
      });

      expect(chats).toEqual([
        {
          jobId: 'job-1',
          professionalId: 'prof-2',
          jobTitle: 'Garçom',
          otherPartyName: 'Carlos Menezes',
          otherPartyPhoto: 'p.png',
          otherPartyRole: Role.PROFISSIONAL,
          lastMessageContent: 'Fechado, Carlos!',
          lastMessageTime: at('2026-11-20T12:00:00Z'),
          unreadCount: 0,
        },
        {
          jobId: 'job-1',
          professionalId: 'prof-1',
          jobTitle: 'Garçom',
          otherPartyName: 'Marina Souza',
          otherPartyPhoto: null,
          otherPartyRole: Role.PROFISSIONAL,
          lastMessageContent: 'Oi Marina',
          lastMessageTime: at('2026-11-19T12:00:00Z'),
          unreadCount: 0,
        },
      ]);
    });

    it('ignora profissionais excluídos/inativos e vagas excluídas', async () => {
      prisma.job.findMany.mockResolvedValue([]);
      prisma.message.findMany.mockResolvedValue([]);

      await useCase.execute({ userId: 'rest-1', userRole: Role.RESTAURANTE });

      expect(firstArgs(prisma.job.findMany).where).toEqual({
        restaurantId: 'rest-1',
        candidaturas: { some: { status: CandidaturaStatus.APROVADA } },
      });
    });

    it('conversa sem mensagem vai para o fim da lista', async () => {
      prisma.job.findMany.mockResolvedValue([
        {
          id: 'job-1',
          title: 'Garçom',
          candidaturas: [
            { professionalId: 'prof-1', professional: { fullName: 'Marina', profilePhoto: null } },
          ],
        },
        {
          id: 'job-2',
          title: 'Cozinheiro',
          candidaturas: [
            { professionalId: 'prof-2', professional: { fullName: 'Carlos', profilePhoto: null } },
          ],
        },
      ]);
      prisma.message.findMany.mockResolvedValue([
        {
          jobId: 'job-2',
          professionalId: 'prof-2',
          content: 'Oi',
          createdAt: at('2026-11-18T12:00:00Z'),
        },
      ]);

      const chats = await useCase.execute({
        userId: 'rest-1',
        userRole: Role.RESTAURANTE,
      });

      expect(chats.map((c) => c.professionalId)).toEqual(['prof-2', 'prof-1']);
      expect(chats[1].lastMessageContent).toBeNull();
    });
  });

  describe('profissional', () => {
    it('lista só as próprias conversas, com a última mensagem dele', async () => {
      prisma.candidatura.findMany.mockResolvedValue([
        {
          job: {
            id: 'job-1',
            title: 'Garçom',
            restaurant: { restaurantName: 'Maré Alta', logoUrl: null },
          },
        },
      ]);
      prisma.message.findMany.mockResolvedValue([
        {
          jobId: 'job-1',
          professionalId: 'prof-1',
          content: 'Até amanhã',
          createdAt: at('2026-11-20T12:00:00Z'),
        },
      ]);

      const chats = await useCase.execute({
        userId: 'prof-1',
        userRole: Role.PROFISSIONAL,
      });

      // A busca de mensagens é restrita à conversa dele
      expect(firstArgs(prisma.message.findMany).where).toEqual({
        jobId: { in: ['job-1'] },
        professionalId: 'prof-1',
      });
      expect(chats).toEqual([
        {
          jobId: 'job-1',
          professionalId: 'prof-1',
          jobTitle: 'Garçom',
          otherPartyName: 'Maré Alta',
          otherPartyPhoto: null,
          otherPartyRole: Role.RESTAURANTE,
          lastMessageContent: 'Até amanhã',
          lastMessageTime: at('2026-11-20T12:00:00Z'),
          unreadCount: 0,
        },
      ]);
    });
  });
});
