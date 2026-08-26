import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestPasswordRecoveryUseCase } from './request-password-recovery.use-case';

const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
};

const PEPPER_FIXTURE = 'test-pepper-fixture-nao-usar-em-producao';

describe('RequestPasswordRecoveryUseCase', () => {
  let useCase: RequestPasswordRecoveryUseCase;
  const mockPrisma = {
    user: { findFirst: jest.fn() },
    passwordResetToken: { create: jest.fn(), updateMany: jest.fn() },
  };
  const mockMailProvider = {
    sendPasswordRecoveryEmail: jest.fn(),
  };
  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue(PEPPER_FIXTURE),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue(PEPPER_FIXTURE);
    useCase = new RequestPasswordRecoveryUseCase(
      mockPrisma as unknown as PrismaService,
      mockConfigService as unknown as ConfigService,
      mockMailProvider as any,
    );
  });

  it('should return 200 and keep response identical when email is not found', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'missing@example.com' }),
    ).resolves.toBeUndefined();

    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockMailProvider.sendPasswordRecoveryEmail).not.toHaveBeenCalled();
  });

  it('should create a password reset token and call mail provider when email exists', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(MOCK_USER);
    mockPrisma.passwordResetToken.create.mockResolvedValue({});
    mockPrisma.passwordResetToken.updateMany.mockResolvedValue({});

    await useCase.execute({ email: MOCK_USER.email });

    expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: MOCK_USER.id, usedAt: null },
        data: expect.any(Object),
      }),
    );

    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: MOCK_USER.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(mockMailProvider.sendPasswordRecoveryEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: MOCK_USER.email,
        token: expect.any(String),
      }),
    );
  });

  it('should hash the token with the configured pepper', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(MOCK_USER);
    mockPrisma.passwordResetToken.create.mockResolvedValue({});
    mockPrisma.passwordResetToken.updateMany.mockResolvedValue({});

    await useCase.execute({ email: MOCK_USER.email });

    const { token } = mockMailProvider.sendPasswordRecoveryEmail.mock.calls[0][0];
    const expectedHash = createHmac('sha256', PEPPER_FIXTURE)
      .update(token)
      .digest('hex');

    const { tokenHash } = mockPrisma.passwordResetToken.create.mock.calls[0][0].data;

    expect(tokenHash).toBe(expectedHash);
    expect(tokenHash).not.toBe(token);
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'PASSWORD_RESET_TOKEN_PEPPER',
    );
  });
});