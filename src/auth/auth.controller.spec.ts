import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  LOGIN_DTO_FIXTURE,
  RECOVER_PASSWORD_DTO_FIXTURE,
  USER_FIXTURE,
} from './__fixtures__/auth.fixtures';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RequestPasswordRecoveryUseCase } from './use-cases/request-password-recovery.use-case';
import { ResetPasswordUseCase } from './use-cases/reset-password.use-case';

describe('AuthController', () => {
  let controller: AuthController;
  const mockAuthService = {
    login: jest.fn(),
  };
  const mockRequestPasswordRecoveryUseCase = {
    execute: jest.fn(),
  };
  const mockResetPasswordUseCase = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: RequestPasswordRecoveryUseCase,
          useValue: mockRequestPasswordRecoveryUseCase,
        },
        { provide: ResetPasswordUseCase, useValue: mockResetPasswordUseCase },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should call authService.login with correct DTO', async () => {
      const mockResponse = {
        access_token: 'token123',
        user: {
          id: USER_FIXTURE.id,
          role: USER_FIXTURE.role,
        },
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(LOGIN_DTO_FIXTURE);

      expect(mockAuthService.login).toHaveBeenCalledWith(LOGIN_DTO_FIXTURE);
      expect(result).toEqual(mockResponse);
    });

    it('should return auth response with access_token and user', async () => {
      const mockResponse = {
        access_token: 'token123',
        user: {
          id: USER_FIXTURE.id,
          role: USER_FIXTURE.role,
        },
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await controller.login(LOGIN_DTO_FIXTURE);

      expect(result.access_token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.role).toBe(USER_FIXTURE.role);
    });

    it('should propagate authService errors', async () => {
      const error = new Error('Login failed');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(LOGIN_DTO_FIXTURE)).rejects.toThrow(error);
    });
  });

  describe('recoverPassword', () => {
    it('should call requestPasswordRecoveryUseCase.execute with correct DTO', async () => {
      mockRequestPasswordRecoveryUseCase.execute.mockResolvedValue(undefined);

      const result = await controller.recoverPassword(RECOVER_PASSWORD_DTO_FIXTURE);

      expect(mockRequestPasswordRecoveryUseCase.execute).toHaveBeenCalledWith(
        RECOVER_PASSWORD_DTO_FIXTURE,
      );
      expect(result).toEqual({
        message: 'Se o e-mail constar em nossa base, as instruções foram enviadas',
      });
    });
  });
});
