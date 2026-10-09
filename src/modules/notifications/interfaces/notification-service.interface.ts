export interface CreateNotificacaoParams {
  userId: string;
  title: string;
  message: string;
}

export interface NewMessageNotificationParams {
  // Só o destinatário: quem envia a mensagem nunca é notificado.
  recipientId: string;
  senderName: string;
  preview: string;
}

export interface INotificacaoService {
  create(params: CreateNotificacaoParams): Promise<void>;
  // Inserção em lote (um único INSERT); devolve quantas linhas foram gravadas.
  createMany(params: CreateNotificacaoParams[]): Promise<number>;
  // Pronto para o futuro módulo de chat (RF08): chamar após persistir a mensagem.
  notifyNewMessage(params: NewMessageNotificationParams): Promise<void>;
}
