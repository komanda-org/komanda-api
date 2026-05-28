import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({});

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user role matches', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.RESTAURANTE]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({ user: { role: Role.RESTAURANTE } });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user role does not match', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.RESTAURANTE]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({ user: { role: Role.PROFISSIONAL } });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access when user is missing', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.RESTAURANTE]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({});

    expect(guard.canActivate(context)).toBe(false);
  });
});
