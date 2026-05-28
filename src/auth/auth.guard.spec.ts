import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const jwtService = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const configService = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException when token is missing', async () => {
    const guard = new AuthGuard(jwtService, configService);
    const request = { headers: {} };
    const context = createContext(request);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    const guard = new AuthGuard(jwtService, configService);
    const request = { headers: { authorization: 'Bearer invalid-token' } };
    const context = createContext(request);

    jest
      .spyOn(jwtService, 'verifyAsync')
      .mockRejectedValueOnce(new Error('Invalid token'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should attach user payload and return true on valid token', async () => {
    const guard = new AuthGuard(jwtService, configService);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid-token' },
    };
    const context = createContext(request);
    const payload = { id: 'user-id', role: 'PROFISSIONAL' };

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValueOnce(payload);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request['user']).toEqual(payload);
  });
});
