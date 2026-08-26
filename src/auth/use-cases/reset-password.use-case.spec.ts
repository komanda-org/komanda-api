import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ResetPasswordUseCase } from './reset-password.use-case';

const MOCK_TOKEN = '550e8400-e29b-41d4-a716-446655440000';
const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  passwordHash: 'oldhash',
};

const PEPPER_FIXTURE = 'test-pepper-fixture-nao-usar-em-producao';

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;

  const mockPrisma = {
    passwordResetToken: { findFirst: jest.fn(), update: jest.fn() },
    user: { update: jest.fn() },
    $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
  };

  const mockAuthCrypto = { hash: jest.fn() };

  const mockConfigService = {
    getOrThrow: jest.fn().mockReturnValue(PEPPER_FIXTURE),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockReturnValue(PEPPER_FIXTURE);
    mockPrisma.$transaction.mockImplementation((ops) => Promise.all(ops));
    useCase = new ResetPasswordUseCase(
      mockPrisma as any,
      mockConfigService as unknown as ConfigService,
      mockAuthCrypto as any,
    );
  });

  it('should throw on invalid token', async () => {
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: MOCK_TOKEN, password: 'newpass123' }),
    ).rejects.toThrow();
  });

  it('should update password and mark token used when valid', async () => {
    const now = new Date();
    const record = {
      id: 'token-id',
      userId: MOCK_USER.id,
      expiresAt: new Date(now.getTime() + 10000),
      usedAt: null,
    };

    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(record);
    mockAuthCrypto.hash.mockResolvedValue('newhash');
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await expect(
      useCase.execute({ token: MOCK_TOKEN, password: 'newpass123' }),
    ).resolves.toBeUndefined();

    expect(mockAuthCrypto.hash).toHaveBeenCalledWith('newpass123');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should look up the token by its HMAC hash using the configured pepper', async () => {
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({ token: MOCK_TOKEN, password: 'newpass123' }),
    ).rejects.toThrow();

    const expectedHash = createHmac('sha256', PEPPER_FIXTURE)
      .update(MOCK_TOKEN)
      .digest('hex');

    expect(mockPrisma.passwordResetToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: expectedHash },
      }),
    );
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'PASSWORD_RESET_TOKEN_PEPPER',
    );
  });
});