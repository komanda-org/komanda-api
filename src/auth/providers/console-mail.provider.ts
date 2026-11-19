import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IMailProvider,
  SendPasswordRecoveryEmailParams,
} from '../interfaces/mail-provider.interface';

const maskEmail = (email: string): string => {
  const [local, domain] = email.split('@');

  return domain ? `${local[0]}***@${domain}` : '***';
};

@Injectable()
export class ConsoleMailProvider implements IMailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  constructor(configService: ConfigService) {
    // Fail closed: sem provider real, o e-mail (e portanto o token) nunca
    // chegaria ao usuário, e o boot em produção ficaria silenciosamente
    // quebrado. Melhor não subir.
    if (configService.get<string>('NODE_ENV') === 'production') {
      throw new Error(
        'ConsoleMailProvider não pode ser usado em produção. Configure um IMailProvider real.',
      );
    }
  }

  sendPasswordRecoveryEmail({
    to,
  }: SendPasswordRecoveryEmailParams): Promise<void> {
    // O token é credencial bearer de uso único: nunca vai para o log.
    this.logger.log(
      `Recuperação de senha solicitada para ${maskEmail(to)}. Token não logado.`,
    );
    return Promise.resolve();
  }
}
