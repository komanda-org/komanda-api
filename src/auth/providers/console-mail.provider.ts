import { Injectable, Logger } from '@nestjs/common';
import type { IMailProvider, SendPasswordRecoveryEmailParams } from '../interfaces/mail-provider.interface';

@Injectable()
export class ConsoleMailProvider implements IMailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  sendPasswordRecoveryEmail({ to, token }: SendPasswordRecoveryEmailParams): Promise<void> {
    const recoveryUrl = `http://localhost:3000/resetar-senha?token=${token}`;
    this.logger.log(`Recuperação de senha solicitada para ${to}. URL de recuperação: ${recoveryUrl}`);
    return Promise.resolve();
  }
}
