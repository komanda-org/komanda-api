import { CnpjAlreadyExistsException } from 'src/auth/exceptions';
import { UserAlreadyExistsException } from 'src/auth/exceptions';
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
        findUnique: jest.fn(),
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
    it('should register a new restaurant successfully', async () => {
      const createRestaurantDto: CreateRestaurantDto = {
        email: 'restaurant@example.com',
        password: 'password123',
        restaurantName: 'Test Restaurant',
        cnpj: '12.345.678/0001-90',
        cuisineType: 'Italiana',
        description: 'Restaurante familiar com pratos tradicionais italianos.',
        address: '123 Main Street',
        phone: '+55 11 99999-9999',
        zipCode: '01310-100',
        logoUrl: 'https://example.com/logo.png',
      };

      const hashedPassword = 'hashedPassword123';
      mockAuthCryptoService.hash.mockResolvedValue(hashedPassword);

      const userId = 'user-123';
      const now = new Date();

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.restaurant.findUnique.mockResolvedValue(null);
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
              restaurantName: createRestaurantDto.restaurantName,
              cnpj: '12345678000190',
              phone: createRestaurantDto.phone,
              address: createRestaurantDto.address,
              cuisineType: createRestaurantDto.cuisineType,
              description: createRestaurantDto.description,
              zipCode: createRestaurantDto.zipCode,
              logoUrl: createRestaurantDto.logoUrl,
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
      expect(result.restaurantName).toBe(createRestaurantDto.restaurantName);
      expect(result.cuisineType).toBe(createRestaurantDto.cuisineType);
      expect(result.description).toBe(createRestaurantDto.description);
    });

    it('should throw UserAlreadyExistsException when email already exists', async () => {
      const createRestaurantDto: CreateRestaurantDto = {
        email: 'existing@example.com',
        password: 'password123',
        restaurantName: 'Test Restaurant',
        cnpj: '12.345.678/0001-90',
        cuisineType: 'Brasileira',
        description:
          'Cozinha brasileira com enfoque em ingredientes regionais.',
        address: '123 Main Street',
        phone: '+55 11 99999-9999',
        zipCode: '01310-100',
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: createRestaurantDto.email,
      });

      await expect(useCase.execute(createRestaurantDto)).rejects.toThrow(
        UserAlreadyExistsException,
      );
    });

    it('should throw CnpjAlreadyExistsException when CNPJ already exists', async () => {
      const createRestaurantDto: CreateRestaurantDto = {
        email: 'restaurant@example.com',
        password: 'password123',
        restaurantName: 'Test Restaurant',
        cnpj: '12.345.678/0001-90',
        cuisineType: 'Italiana',
        description: 'Restaurante familiar com pratos tradicionais italianos.',
        address: '123 Main Street',
        phone: '+55 11 99999-9999',
        zipCode: '01310-100',
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.restaurant.findUnique.mockResolvedValue({
        cnpj: '12345678000190',
      });

      await expect(useCase.execute(createRestaurantDto)).rejects.toThrow(
        CnpjAlreadyExistsException,
      );
    });
  });
});
