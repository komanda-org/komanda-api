export class MessageResponseDto {
  id: string;
  jobId: string;
  professionalId!: string;
  senderId: string;
  content: string;
  createdAt: Date;

  constructor(message: {
    id: string;
    jobId: string;
    senderId: string;
    content: string;
    createdAt: Date;
    professionalId?: string | null;
  }) {
    this.id = message.id;
    this.jobId = message.jobId;
    this.professionalId = message.professionalId ?? '';
    this.senderId = message.senderId;
    this.content = message.content;
    this.createdAt = message.createdAt;
  }
}
