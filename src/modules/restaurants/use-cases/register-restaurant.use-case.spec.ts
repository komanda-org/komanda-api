import { ConflictException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { RegisterRestaurantUseCase } from './register-restaurant.use-case';
import { CreateRestaurantDto } from '../dto/create-restaurant.dto';

describe('RegisterRestaurantUseCase', () => {
  let useCase: RegisterRestaurantUseCase;
  let mockPrisma: any;
  let mockAuthCryptoService: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      restaurant: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockAuthCryptoService = {
      hash: jest.fn(),
    };

    useCase = new RegisterRestaurantUseCase(mockPrisma, mockAuthCryptoService);
  });

  describe('execute', () => {
    const createRestaurantDto: CreateRestaurantDto = {
      email: 'restaurant@example.com',
      password: 'password123',
      tradeName: 'Test Restaurant',
      cnpj: '12.345.678/0001-90',
      address: '123 Main Street',
      phone: '+55 11 99999-9999',
      zipCode: '01310-100',
      latitude: -23.55052,
      longitude: -46.633308,
    };

    it('should register a new restaurant successfully', async () => {
      const hashedPassword = 'hashedPassword123';
      mockAuthCryptoService.hash.mockResolvedValue(hashedPassword);

      const userId = 'user-123';
      const now = new Date();

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: userId,
              email: createRestaurantDto.email,
              passwordHash: hashedPassword,
              role: Role.RESTAURANTE,
              createdAt: now,
              updatedAt: now,
            }),
          },
          restaurant: {
            create: jest.fn().mockResolvedValue({
              userId,
              tradeName: createRestaurantDto.tradeName,
              phone: createRestaurantDto.phone,
              address: createRestaurantDto.address,
              latitude: createRestaurantDto.latitude,
              longitude: createRestaurantDto.longitude,
              cnpj: createRestaurantDto.cnpj,
              zipCode: createRestaurantDto.zipCode,
              createdAt: now,
              updatedAt: now,
              user: {
                id: userId,
                email: createRestaurantDto.email,
                role: Role.RESTAURANTE,
              },
            }),
          },
        };
        return callback(mockTx);
      });

      const result = await useCase.execute(createRestaurantDto);

      expect(result.userId).toBe(userId);
      expect(result.email).toBe(createRestaurantDto.email);
      expect(result.role).toBe(Role.RESTAURANTE);
      expect(result.tradeName).toBe(createRestaurantDto.tradeName);
    });

    it('should throw ConflictException when email already exists (P2002)', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '7.8.0',
        }
      );

      // O banco rejeita a transação direto com o erro de duplicidade
      mockPrisma.$transaction.mockRejectedValue(p2002Error);

      await expect(useCase.execute(createRestaurantDto)).rejects.toThrow(
        ConflictException
      );
    });
  });
});