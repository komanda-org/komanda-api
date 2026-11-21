import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthCryptoService } from './auth-crypto.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException } from './exceptions';

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authCrypto: AuthCryptoService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // E-mail inexistente, conta excluída e senha errada recebem a mesma
    // resposta: respostas diferentes deixariam descobrir quais e-mails estão
    // cadastrados.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await this.authCrypto.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    // Só depois da senha correta: quem não tem a senha não descobre que a
    // conta existe e está inativa.
    if (!user.active) {
      throw new UnauthorizedException('Conta inativa');
    }

    const token = this.generateToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        role: user.role,
      },
    };
  }

  private generateToken(user: { id: string; role: Role }): string {
    const payload = { id: user.id, role: user.role };
    return this.authCrypto.signToken(payload);
  }
}
