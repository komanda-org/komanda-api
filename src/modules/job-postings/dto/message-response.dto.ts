export interface ChatMessage {
  id: string;
  jobId: string;
  /** Profissional da conversa (conversa = vaga + profissional). */
  professionalId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

export const CHAT_MESSAGE_SELECT = {
  id: true,
  jobId: true,
  professionalId: true,
  senderId: true,
  content: true,
  createdAt: true,
} as const;

export class MessageResponseDto implements ChatMessage {
  id: string;
  jobId: string;
  professionalId: string;
  senderId: string;
  content: string;
  createdAt: Date;

  constructor(message: ChatMessage) {
    this.id = message.id;
    this.jobId = message.jobId;
    this.professionalId = message.professionalId;
    this.senderId = message.senderId;
    this.content = message.content;
    this.createdAt = message.createdAt;
  }
}
