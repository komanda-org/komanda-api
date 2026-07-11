import { Role } from '@prisma/client';

/**
 * Shape do payload que o AuthGuard grava em `request.user`
 * (ver auth.service.ts -> generateToken).
 */
export interface JwtPayload {
  id: string;
  role: Role;
}

export interface AuthenticatedRequest {
  user: JwtPayload;
}
