import { PrismaService } from 'src/prisma/prisma.service';
import { RequestPasswordRecoveryUseCase } from './request-password-recovery.use-case';

const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
};

describe('RequestPasswordRecoveryUseCase', () => {
  let useCase: RequestPasswordRecoveryUseCase;
  const mockPrisma = {
    user: { findUnique: jest.fn() },
    passwordResetToken: { create: jest.fn() },
  };
  const mockMailProvider = {
    sendPasswordRecoveryEmail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RequestPasswordRecoveryUseCase(
      mockPrisma as unknown as PrismaService,
      mockMailProvider as any,
    );
  });

  it('should return 200 and keep response identical when email is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'missing@example.com' }),
    ).resolves.toBeUndefined();

    expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mockMailProvider.sendPasswordRecoveryEmail).not.toHaveBeenCalled();
  });

  it('should create a password reset token and call mail provider when email exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);
    mockPrisma.passwordResetToken.create.mockResolvedValue({});

    await useCase.execute({ email: MOCK_USER.email });

    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: MOCK_USER.id,
          token: expect.any(String),
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
});
