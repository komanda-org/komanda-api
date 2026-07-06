import { Inject, Injectable } from '@nestjs/common';
import { randomUUID, createHmac } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import type { IMailProvider } from '../interfaces/mail-provider.interface';
import { MAIL_PROVIDER } from '../interfaces/mail-provider.interface';
import { RecoverPasswordDto } from '../dto/recover-password.dto';

@Injectable()
export class RequestPasswordRecoveryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: IMailProvider,
  ) {}

  // simple in-memory cooldown per email (production: use distributed rate limiter)
  private static readonly COOLDOWN_MS = 60_000; // 1 minute
  private static readonly lastRequestAt = new Map<string, number>();

  async execute(dto: RecoverPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, active: true, deletedAt: null },
    });

    if (!user) {
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

    const pepper = process.env.PASSWORD_RESET_TOKEN_PEPPER ?? '';
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
