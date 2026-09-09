import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthCryptoService } from '../auth-crypto.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UnauthorizedException } from '../exceptions/unauthorized.exception';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly authCrypto: AuthCryptoService,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<void> {
    const pepper = this.configService.getOrThrow<string>(
      'PASSWORD_RESET_TOKEN_PEPPER',
    );
    const tokenHash = createHmac('sha256', pepper)
      .update(dto.token)
      .digest('hex');

    const record = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (record.usedAt) {
      throw new UnauthorizedException('Token already used');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expired');
    }

    const newPasswordHash = await this.authCrypto.hash(dto.password);

    // update user password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}
