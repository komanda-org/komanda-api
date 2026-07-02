import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantsController } from './Restaurants.controller';
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

    const result = { userId: 'user-1', email: dto.email };
    jest.spyOn(registerRestaurantUseCase, 'execute').mockResolvedValue(result);

    expect(await controller.create(dto)).toBe(result);
    expect(registerRestaurantUseCase.execute).toHaveBeenCalledWith(dto);
  });
});
