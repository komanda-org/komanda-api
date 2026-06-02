import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import {
  LOGIN_DTO_FIXTURE,
  LOGIN_DTO_INVALID_EMAIL,
  LOGIN_DTO_INVALID_PASS,
  USER_FIXTURE,
  USER_FIXTURE_DELETED,
  USER_FIXTURE_INACTIVE,
} from './__fixtures__/auth.fixtures';
import { createMockAuthCryptoService } from './__mocks__/auth-crypto.mock';
import { createMockPrismaService } from './__mocks__/prisma.mock';
import { AuthService } from './auth.service';
import { AuthCryptoService } from './auth-crypto.service';
import { UnauthorizedException, UserNotFoundException } from './exceptions';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let mockAuthCrypto: ReturnType<typeof createMockAuthCryptoService>;

  beforeEach(async () => {
    mockPrisma = createMockPrismaService();
    mockAuthCrypto = createMockAuthCryptoService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthCryptoService, useValue: mockAuthCrypto },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return token and user data with valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      mockAuthCrypto.compare.mockResolvedValue(true);

      const result = await service.login(LOGIN_DTO_FIXTURE);

      expect(result.access_token).toBeDefined();
      expect(result.user.id).toBe(USER_FIXTURE.id);
      expect(result.user.role).toBe(USER_FIXTURE.role);
    });

    it('should throw UserNotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(LOGIN_DTO_INVALID_EMAIL)).rejects.toThrow(
        UserNotFoundException,
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      mockAuthCrypto.compare.mockResolvedValue(false);

      await expect(service.login(LOGIN_DTO_INVALID_PASS)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user account is deleted', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(USER_FIXTURE_DELETED);

      await expect(service.login(LOGIN_DTO_FIXTURE)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user account is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(USER_FIXTURE_INACTIVE);
      mockAuthCrypto.compare.mockResolvedValue(true);

      await expect(service.login(LOGIN_DTO_FIXTURE)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return token with id and role in payload', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(USER_FIXTURE);
      mockAuthCrypto.compare.mockResolvedValue(true);

      await service.login(LOGIN_DTO_FIXTURE);

      expect(mockAuthCrypto.signToken).toHaveBeenCalledWith({
        id: USER_FIXTURE.id,
        role: USER_FIXTURE.role,
      });
    });
  });

  describe('generateToken', () => {
    it('should generate token with correct payload', () => {
      const payload = { id: USER_FIXTURE.id, role: USER_FIXTURE.role };

      service['generateToken'](payload);

      expect(mockAuthCrypto.signToken).toHaveBeenCalledWith(payload);
    });

    it('should call authCrypto.signToken', () => {
      const payload = { id: USER_FIXTURE.id, role: USER_FIXTURE.role };

      service['generateToken'](payload);

      expect(mockAuthCrypto.signToken).toHaveBeenCalled();
    });
  });
});
