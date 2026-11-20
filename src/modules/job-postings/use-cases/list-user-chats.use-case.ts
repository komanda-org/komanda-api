import { Injectable } from '@nestjs/common';
import { CandidaturaStatus, Prisma, Role } from '@prisma/client';
import { VISIBLE_RESTAURANT_WHERE } from 'src/modules/jobs/job.mapper';
import { PrismaService } from 'src/prisma/prisma.service';

interface ListUserChatsInput {
  userId: string;
  userRole: Role;
}

interface ChatListItem {
  jobId: string;
  /** Conversa = vaga + profissional: com 2 aprovados, a vaga tem 2 conversas. */
  professionalId: string;
  jobTitle: string;
  otherPartyName: string;
  otherPartyPhoto: string | null;
  otherPartyRole: Role;
  lastMessageContent: string | null;
  lastMessageTime: Date | null;
  unreadCount: number;
}

type LastMessage = { content: string; createdAt: Date };

// Vaga ainda acessível no chat (mesmo filtro do assert-chat-access).
const LIVE_JOB_WHERE = { active: true, deletedAt: null } as const;

const ACTIVE_PROFESSIONAL_WHERE: Prisma.ProfessionalWhereInput = {
  active: true,
  deletedAt: null,
  user: { active: true, deletedAt: null },
};

const conversationKey = (jobId: string, professionalId: string) =>
  `${jobId}:${professionalId}`;

@Injectable()
export class ListUserChatsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListUserChatsInput): Promise<ChatListItem[]> {
    const { userId, userRole } = input;

    const chats =
      userRole === Role.RESTAURANTE
        ? await this.listRestaurantChats(userId)
        : await this.listProfessionalChats(userId);

    // Conversa com mensagem mais recente primeiro; sem mensagem vai para o fim.
    return chats.sort(
      (a, b) =>
        (b.lastMessageTime?.getTime() ?? -Infinity) -
        (a.lastMessageTime?.getTime() ?? -Infinity),
    );
  }

  private async listRestaurantChats(
    restaurantId: string,
  ): Promise<ChatListItem[]> {
    // Uma conversa por candidatura APROVADA em vaga do restaurante, ignorando
    // profissionais com conta excluída ou inativa.
    const candidaturas = await this.prisma.candidatura.findMany({
      where: {
        status: CandidaturaStatus.APROVADA,
        job: { restaurantId, ...LIVE_JOB_WHERE },
        professional: ACTIVE_PROFESSIONAL_WHERE,
      },
      select: {
        professionalId: true,
        job: { select: { id: true, title: true } },
        professional: { select: { fullName: true, profilePhoto: true } },
      },
    });

    const lastMessages = await this.lastMessagesByConversation({
      job: { restaurantId },
    });

    return candidaturas.map((cand) => {
      const last =
        lastMessages[conversationKey(cand.job.id, cand.professionalId)];
      return {
        jobId: cand.job.id,
        professionalId: cand.professionalId,
        jobTitle: cand.job.title,
        otherPartyName: cand.professional.fullName,
        otherPartyPhoto: cand.professional.profilePhoto ?? null,
        otherPartyRole: Role.PROFISSIONAL,
        lastMessageContent: last?.content ?? null,
        lastMessageTime: last?.createdAt ?? null,
        // ponytail: unreadCount fixo em 0 (sem tabela de leitura por usuário).
        // Upgrade: contar mensagens com createdAt > última leitura do usuário na conversa.
        unreadCount: 0,
      };
    });
  }

  private async listProfessionalChats(
    professionalId: string,
  ): Promise<ChatListItem[]> {
    // Candidaturas APROVADAS do profissional em vagas de restaurante ativo.
    const candidaturas = await this.prisma.candidatura.findMany({
      where: {
        professionalId,
        status: CandidaturaStatus.APROVADA,
        job: { ...LIVE_JOB_WHERE, restaurant: VISIBLE_RESTAURANT_WHERE },
      },
      select: {
        job: {
          select: {
            id: true,
            title: true,
            restaurant: { select: { restaurantName: true, logoUrl: true } },
          },
        },
      },
    });

    // Só as mensagens da conversa DELE: o filtro por professionalId impede
    // que entre a última mensagem trocada com outro aprovado da mesma vaga.
    const lastMessages = await this.lastMessagesByConversation({
      professionalId,
    });

    return candidaturas.map((cand) => {
      const last = lastMessages[conversationKey(cand.job.id, professionalId)];
      return {
        jobId: cand.job.id,
        professionalId,
        jobTitle: cand.job.title,
        otherPartyName: cand.job.restaurant.restaurantName,
        otherPartyPhoto: cand.job.restaurant.logoUrl ?? null,
        otherPartyRole: Role.RESTAURANTE,
        lastMessageContent: last?.content ?? null,
        lastMessageTime: last?.createdAt ?? null,
        // ponytail: unreadCount fixo em 0 (mesmo limite acima).
        unreadCount: 0,
      };
    });
  }

  // Última mensagem de cada conversa (vaga + profissional) em uma única query,
  // sem o N+1 de um findFirst por conversa.
  private async lastMessagesByConversation(
    where: Prisma.MessageWhereInput,
  ): Promise<Record<string, LastMessage>> {
    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      distinct: ['jobId', 'professionalId'],
      select: {
        jobId: true,
        professionalId: true,
        content: true,
        createdAt: true,
      },
    });

    const lastByConversation: Record<string, LastMessage> = {};
    for (const message of messages) {
      const key = conversationKey(message.jobId, message.professionalId);
      lastByConversation[key] ??= {
        content: message.content,
        createdAt: message.createdAt,
      };
    }
    return lastByConversation;
  }
}
