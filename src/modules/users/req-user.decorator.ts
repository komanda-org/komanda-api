import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';

export const ReqUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user; // O Passport injeta o usuário aqui após validar o JWT
  },
);
