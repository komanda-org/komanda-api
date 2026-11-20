import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { ACCOUNT_UNAVAILABLE_MESSAGE, AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const prisma = { user: { findUnique: jest.fn() } };

  const guard = new AuthGuard(
    jwtService,
    configService,
    prisma as unknown as PrismaService,
  );

  const payload = { id: 'user-id', role: Role.PROFISSIONAL };
  const activeUser = { role: Role.PROFISSIONAL, active: true, deletedAt: null };

  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  const withValidToken = () => {
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid-token' },
    };
    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValueOnce(payload);
    return { request, context: createContext(request) };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException when token is missing', async () => {
    const context = createContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    const context = createContext({
      headers: { authorization: 'Bearer invalid-token' },
    });

    jest
      .spyOn(jwtService, 'verifyAsync')
      .mockRejectedValueOnce(new Error('Invalid token'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should attach user payload and return true on valid token of an active account', async () => {
    const { request, context } = withValidToken();
    prisma.user.findUnique.mockResolvedValue(activeUser);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request['user']).toEqual(payload);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      select: { role: true, active: true, deletedAt: true },
    });
  });

  it.each([
    ['conta excluída (soft-delete)', { ...activeUser, deletedAt: new Date() }],
    ['conta desativada', { ...activeUser, active: false }],
    ['conta que não existe mais', null],
    [
      'role do token diferente do banco',
      { ...activeUser, role: Role.RESTAURANTE },
    ],
  ])('token válido mas %s → 401', async (_case, user) => {
    const { request, context } = withValidToken();
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException(ACCOUNT_UNAVAILABLE_MESSAGE),
    );
    expect(request['user']).toBeUndefined();
  });
});
