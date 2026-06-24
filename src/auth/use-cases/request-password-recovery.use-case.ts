import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  IMailProvider,
  MAIL_PROVIDER,
} from '../interfaces/mail-provider.interface';
import { RecoverPasswordDto } from '../dto/recover-password.dto';

@Injectable()
export class RequestPasswordRecoveryUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER)
    private readonly mailProvider: IMailProvider,
  ) {}

  async execute(dto: RecoverPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        token,
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
