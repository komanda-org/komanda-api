import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthCryptoService } from './auth-crypto.service';
import { createMockJwtService } from './__mocks__/jwt.mock';

jest.mock('bcrypt');

describe('AuthCryptoService', () => {
  let service: AuthCryptoService;
  let mockJwt: ReturnType<typeof createMockJwtService>;

  beforeEach(async () => {
    mockJwt = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthCryptoService,
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthCryptoService>(AuthCryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hash', () => {
    it('should return a non-empty string', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_value');

      const result = await service.hash('plain');

      expect(result).toBe('hashed_value');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('compare', () => {
    it('should return true when plain matches hash', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.compare('plain', 'hash');

      expect(result).toBe(true);
    });

    it('should return false when plain does not match hash', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.compare('plain', 'hash');

      expect(result).toBe(false);
    });
  });

  describe('signToken', () => {
    it('should call jwtService.sign with the given payload', () => {
      const payload = { id: 'user-id', role: 'PROFISSIONAL' as const };

      service.signToken(payload);

      expect(mockJwt.sign).toHaveBeenCalledWith(payload);
    });

    it('should return the token from jwtService.sign', () => {
      const payload = { id: 'user-id', role: 'PROFISSIONAL' as const };
      const token = service.signToken(payload);

      expect(token).toBe(mockJwt.sign(payload));
    });
  });
});
