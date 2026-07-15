import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { RestaurantsController } from './Restaurants.controller';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { RegisterRestaurantUseCase } from './use-cases/register-restaurant.use-case';

describe('RestaurantsController', () => {
  let controller: RestaurantsController;
  let registerRestaurantUseCase: RegisterRestaurantUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantsController],
      providers: [
        {
          provide: RegisterRestaurantUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RestaurantsController>(RestaurantsController);
    registerRestaurantUseCase = module.get<RegisterRestaurantUseCase>(
      RegisterRestaurantUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call registerRestaurantUseCase.execute with dto', async () => {
    const dto = {
      email: 'restaurant@example.com',
      password: 'password123',
      restaurantName: 'My Restaurant',
      cnpj: '12.345.678/0001-90',
      cuisineType: 'Italiana',
      description: 'Descrição do restaurante',
      address: 'Rua A, 123',
      phone: '+55 11 99999-9999',
      zipCode: '01310-100',
    };

    const result: RestaurantResponseDto = {
      userId: 'user-1',
      email: dto.email,
      role: Role.RESTAURANTE,
      restaurantName: dto.restaurantName,
      cnpj: dto.cnpj,
      phone: dto.phone,
      cuisineType: dto.cuisineType,
      description: dto.description,
      address: dto.address,
      zipCode: dto.zipCode,
      createdAt: new Date(),
    };
    // Guardamos a referência do spy: passar o método solto para o expect o
    // desprende do objeto (regra @typescript-eslint/unbound-method).
    const executeSpy = jest
      .spyOn(registerRestaurantUseCase, 'execute')
      .mockResolvedValue(result);

    expect(await controller.create(dto)).toBe(result);
    expect(executeSpy).toHaveBeenCalledWith(dto);
  });
});
