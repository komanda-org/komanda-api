import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { MyJobsController } from './MyJobs.controller';
import { ListMyJobsUseCase } from './use-cases/list-my-jobs.use-case';

describe('MyJobsController', () => {
  let controller: MyJobsController;
  let listMyJobsUseCase: ListMyJobsUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyJobsController],
      providers: [
        {
          provide: ListMyJobsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<MyJobsController>(MyJobsController);
    listMyJobsUseCase = module.get<ListMyJobsUseCase>(ListMyJobsUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lista as vagas usando o restaurante do token e os filtros da query', async () => {
    const req = {
      user: { id: 'restaurant-1', role: Role.RESTAURANTE },
    };

    const response = {
      data: [],
      total: 0,
      skip: 10,
      take: 5,
    };

    const executeSpy = jest
      .spyOn(listMyJobsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listMyJobs({ skip: 10, take: 5 }, req);

    // O restaurantId nunca pode vir da query ou do body, só do token.
    expect(executeSpy).toHaveBeenCalledWith({
      restaurantId: 'restaurant-1',
      skip: 10,
      take: 5,
    });
    expect(result).toBe(response);
  });

  it('lista as vagas com skip/take padrão quando a query não informa', async () => {
    const req = {
      user: { id: 'restaurant-2', role: Role.RESTAURANTE },
    };

    const response = { data: [], total: 0, skip: 0, take: 20 };

    const executeSpy = jest
      .spyOn(listMyJobsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listMyJobs({}, req);

    expect(executeSpy).toHaveBeenCalledWith({
      restaurantId: 'restaurant-2',
      skip: undefined,
      take: undefined,
    });
    expect(result).toBe(response);
  });
});
