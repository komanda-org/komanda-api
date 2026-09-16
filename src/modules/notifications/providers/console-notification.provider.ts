import { Injectable, Logger } from '@nestjs/common';
import { INotificacaoService } from '../interfaces/notification-service.interface';

@Injectable()
export class ConsoleNotificationProvider implements INotificacaoService {
  private readonly logger = new Logger(ConsoleNotificationProvider.name);

  create(params: { userId: string; title: string; message: string }): void {
    this.logger.log(
      `Notificação para ${params.userId}: [${params.title}] ${params.message}`,
    );
  }
}
