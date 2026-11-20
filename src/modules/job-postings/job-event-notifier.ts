import { Inject, Injectable, Logger } from '@nestjs/common';
import { CandidaturaStatus } from '@prisma/client';
import type { INotificacaoService } from 'src/modules/notifications/interfaces/notification-service.interface';
import { NOTIFICACAO_SERVICE } from 'src/modules/notifications/notifications.module';

// Prévia da mensagem do chat no sininho.
export const MESSAGE_PREVIEW_MAX = 120;

export function messagePreview(content: string): string {
  const text = content.trim().replace(/\s+/g, ' ');
  return text.length > MESSAGE_PREVIEW_MAX
    ? `${text.slice(0, MESSAGE_PREVIEW_MAX - 1)}…`
    : text;
}

/**
 * Avisos do fluxo de vaga: candidatura nova, decisão do restaurante, vaga
 * encerrada e mensagem no chat. Os textos ficam todos aqui.
 *
 * Notificação é efeito colateral: quando é chamada, a ação principal (a
 * candidatura, a decisão, a mensagem) já foi gravada. Falha de banco aqui vira
 * log e não desfaz nem quebra a resposta, como no aviso de vaga nova
 * (CreateJobPostingUseCase).
 */
@Injectable()
export class JobEventNotifier {
  private readonly logger = new Logger(JobEventNotifier.name);

  constructor(
    @Inject(NOTIFICACAO_SERVICE)
    private readonly notificacoes: INotificacaoService,
  ) {}

  newApplication(input: {
    restaurantId: string;
    jobTitle: string;
    professionalName: string;
  }): Promise<void> {
    return this.safely(`candidatura nova (${input.restaurantId})`, () =>
      this.notificacoes.create({
        userId: input.restaurantId,
        title: `Nova candidatura: ${input.jobTitle}`,
        message: `${input.professionalName} se candidatou à vaga "${input.jobTitle}".`,
      }),
    );
  }

  applicationDecided(input: {
    professionalId: string;
    jobTitle: string;
    restaurantName: string;
    status: CandidaturaStatus;
  }): Promise<void> {
    if (input.status === CandidaturaStatus.PENDENTE) {
      return Promise.resolve();
    }
    const approved = input.status === CandidaturaStatus.APROVADA;
    return this.safely(`decisão de candidatura (${input.professionalId})`, () =>
      this.notificacoes.create({
        userId: input.professionalId,
        title: approved
          ? `Candidatura aprovada: ${input.jobTitle}`
          : `Candidatura não aprovada: ${input.jobTitle}`,
        message: approved
          ? `${input.restaurantName} aprovou sua candidatura. O chat com o restaurante já está liberado.`
          : `${input.restaurantName} seguiu com outros candidatos para a vaga "${input.jobTitle}".`,
      }),
    );
  }

  pendingClosedWithJob(input: {
    professionalIds: string[];
    jobTitle: string;
    restaurantName: string;
  }): Promise<void> {
    return this.safely(
      `vaga encerrada (${input.professionalIds.length} candidatos)`,
      () =>
        this.notificacoes.createMany(
          input.professionalIds.map((professionalId) => ({
            userId: professionalId,
            title: `Vaga encerrada: ${input.jobTitle}`,
            message: `${input.restaurantName} encerrou a vaga "${input.jobTitle}" e sua candidatura não foi selecionada.`,
          })),
        ),
    );
  }

  newMessage(input: {
    recipientIds: string[];
    senderName: string;
    content: string;
  }): Promise<void> {
    const preview = messagePreview(input.content);
    return this.safely(`mensagem nova (${input.recipientIds.length})`, () =>
      Promise.all(
        input.recipientIds.map((recipientId) =>
          this.notificacoes.notifyNewMessage({
            recipientId,
            senderName: input.senderName,
            preview,
          }),
        ),
      ),
    );
  }

  // Público para quem precisa buscar dados antes de avisar: falha da busca
  // também não pode quebrar a ação principal, que já foi gravada.
  async safely(what: string, send: () => Promise<unknown>): Promise<void> {
    try {
      await send();
    } catch (error) {
      this.logger.error(
        `Falha ao notificar ${what}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
