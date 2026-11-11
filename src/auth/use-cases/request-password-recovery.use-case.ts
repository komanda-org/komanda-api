import { Inject, Injectable } from '@nestjs/common';
import { randomUUID, createHmac } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IMailProvider } from '../interfaces/mail-provider.interface';
import { MAIL_PROVIDER } from '../interfaces/mail-provider.interface';
import { RecoverPasswordDto } from '../dto/recover-password.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RequestPasswordRecoveryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: IMailProvider,
  ) {}

  private static readonly COOLDOWN_MS = 60_000; // 1 minute

  async execute(dto: RecoverPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, active: true, deletedAt: null },
    });

    if (!user) {
      return;
    }

    // Cooldown por e-mail: pedidos repetidos dentro da janela são ignorados
    // (resposta idêntica, para não vazar existência da conta). Fica no banco
    // em vez de memória para valer entre instâncias.
    const recentToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(
            Date.now() - RequestPasswordRecoveryUseCase.COOLDOWN_MS,
          ),
        },
      },
    });

    if (recentToken) {
      return;
    }

    // Invalidate previous tokens for this user to avoid multiple valid tokens
    // mark previous tokens as used (preserve audit trail)
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const pepper = this.configService.getOrThrow<string>(
      'PASSWORD_RESET_TOKEN_PEPPER',
    );
    const tokenHash = createHmac('sha256', pepper).update(token).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId: user.id,
      },
    });

    await this.mailProvider.sendPasswordRecoveryEmail({
      to: user.email,
      token,
    });
  }
}
