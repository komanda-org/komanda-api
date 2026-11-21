import { Injectable } from '@nestjs/common';
import { CandidaturaStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface ListUserChatsInput {
  userId: string;
  userRole: Role;
}

interface ChatListItem {
  jobId: string;
  professionalId: string;
  jobTitle: string;
  otherPartyName: string;
  otherPartyPhoto: string | null;
  otherPartyRole: Role;
  lastMessageContent: string | null;
  lastMessageTime: Date | null;
  unreadCount: number;
}

type LastMessage = { content: string | null; createdAt: Date | null };

@Injectable()
export class ListUserChatsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListUserChatsInput): Promise<ChatListItem[]> {
    const { userId, userRole } = input;

    if (userRole === Role.RESTAURANTE) {
      return this.listRestaurantChats(userId);
    }

    return this.listProfessionalChats(userId);
  }

  private async listRestaurantChats(restaurantId: string): Promise<ChatListItem[]> {
    // Buscar vagas do restaurante que têm pelo menos uma candidatura APROVADA
    const jobs = await this.prisma.job.findMany({
      where: {
        restaurantId,
        candidaturas: {
          some: {
            status: CandidaturaStatus.APROVADA,
          },
        },
      },
      select: {
        id: true,
        title: true,
        candidaturas: {
          where: { status: CandidaturaStatus.APROVADA },
          select: {
            professionalId: true,
            professional: {
              select: {
                fullName: true,
                profilePhoto: true,
              },
            },
          },
        },
      },
    });

    // Última mensagem de cada job (o banco não tem professionalId na mensagem,
    // então não dá para filtrar por conversa; usamos a última do job).
    const lastMessageByJob = await this.lastMessagesByJob(
      jobs.map((job) => job.id),
    );

    const chats: ChatListItem[] = [];

    for (const job of jobs) {
      const lastMessage = lastMessageByJob[job.id];
      // Para cada candidatura aprovada, criar uma entrada de chat
      for (const candidatura of job.candidaturas) {
        // ponytail: unreadCount hardcoded em 0 (sem tabela de leitura por usuário).
        const unreadCount = 0;

        chats.push({
          jobId: job.id,
          professionalId: candidatura.professionalId,
          jobTitle: job.title,
          otherPartyName: candidatura.professional.fullName,
          otherPartyPhoto: candidatura.professional.profilePhoto ?? null,
          otherPartyRole: Role.PROFISSIONAL,
          lastMessageContent: lastMessage?.content ?? null,
          lastMessageTime: lastMessage?.createdAt ?? null,
          unreadCount,
        });
      }
    }

    // Ordenar por última mensagem (mais recente primeiro); sem mensagem vai ao fim.
    chats.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    return chats;
  }

  private async listProfessionalChats(professionalId: string): Promise<ChatListItem[]> {
    // Buscar candidaturas APROVADAS do profissional
    const candidaturas = await this.prisma.candidatura.findMany({
      where: {
        professionalId,
        status: CandidaturaStatus.APROVADA,
      },
      select: {
        job: {
          select: {
            id: true,
            title: true,
            restaurant: {
              select: {
                restaurantName: true,
                logoUrl: true,
              },
            },
          },
        },
      },
    });

    // Última mensagem de cada job (mesma limitação acima).
    const lastMessageByJob = await this.lastMessagesByJob(
      candidaturas.map((cand) => cand.job.id),
    );

    const chats: ChatListItem[] = [];

    for (const cand of candidaturas) {
      const lastMessage = lastMessageByJob[cand.job.id];
      // ponytail: unreadCount hardcoded em 0 (mesmo ceiling acima).
      const unreadCount = 0;

      chats.push({
        jobId: cand.job.id,
        professionalId,
        jobTitle: cand.job.title,
        otherPartyName: cand.job.restaurant.restaurantName,
        otherPartyPhoto: cand.job.restaurant.logoUrl ?? null,
        otherPartyRole: Role.RESTAURANTE,
        lastMessageContent: lastMessage?.content ?? null,
        lastMessageTime: lastMessage?.createdAt ?? null,
        unreadCount,
      });
    }

    // Ordenar por última mensagem (mais recente primeiro); sem mensagem vai ao fim.
    chats.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    return chats;
  }

  // Busca a última mensagem de cada job em uma única query (evita o N+1 de
  // fazer findFirst por chat dentro do loop acima).
  private async lastMessagesByJob(
    jobIds: string[],
  ): Promise<Record<string, LastMessage>> {
    if (jobIds.length === 0) return {};

    const messages = await this.prisma.message.findMany({
      where: { jobId: { in: jobIds } },
      orderBy: { createdAt: 'desc' },
      select: { jobId: true, content: true, createdAt: true },
    });

    const lastByJob: Record<string, LastMessage> = {};
    for (const message of messages) {
      if (!lastByJob[message.jobId]) {
        lastByJob[message.jobId] = {
          content: message.content,
          createdAt: message.createdAt,
        };
      }
    }

    return lastByJob;
  }
}
