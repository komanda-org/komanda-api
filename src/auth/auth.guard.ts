import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import type { JwtPayload } from './interfaces/authenticated-request.interface';

export const ACCOUNT_UNAVAILABLE_MESSAGE =
  'Sessão encerrada: a conta foi excluída ou desativada';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token não encontrado');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    // O token vale 7 dias e não tem lista de revogação: sem esta consulta,
    // uma conta excluída continuaria usando a API até ele expirar. É uma
    // busca por chave primária por requisição. Role diferente do banco
    // também derruba (token antigo de uma conta que mudou).
    const user = await this.prisma.user.findUnique({
      where: { id: payload.id },
      select: { role: true, active: true, deletedAt: true },
    });

    if (!user || user.deletedAt || !user.active || user.role !== payload.role) {
      throw new UnauthorizedException(ACCOUNT_UNAVAILABLE_MESSAGE);
    }

    request['user'] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
