export class MessageResponseDto {
  id: string;
  jobId: string;
  senderId: string;
  content: string;
  createdAt: Date;

  constructor(message: {
    id: string;
    jobId: string;
    senderId: string;
    content: string;
    createdAt: Date;
  }) {
    this.id = message.id;
    this.jobId = message.jobId;
    this.senderId = message.senderId;
    this.content = message.content;
    this.createdAt = message.createdAt;
  }
}
