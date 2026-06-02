import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthCryptoService } from './auth-crypto.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { UnauthorizedException, UserNotFoundException } from './exceptions';

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

    if (!user) {
      throw new UserNotFoundException();
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('User account has been deleted');
    }

    const passwordMatches = await this.authCrypto.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid password');
    }

    if (!user.active) {
      throw new UnauthorizedException('User account is inactive');
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
