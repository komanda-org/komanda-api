import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { ListNotificationsUseCase } from './use-cases/list-notifications.use-case';
import { MarkAsReadUseCase } from './use-cases/mark-as-read.use-case';
import { ConsoleNotificationProvider } from './providers/console-notification.provider';

export const NOTIFICACAO_SERVICE = 'NOTIFICACAO_SERVICE';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    ListNotificationsUseCase,
    MarkAsReadUseCase,
    {
      provide: NOTIFICACAO_SERVICE,
      useClass: ConsoleNotificationProvider,
    },
  ],
  exports: [NOTIFICACAO_SERVICE],
})
export class NotificationsModule {}
