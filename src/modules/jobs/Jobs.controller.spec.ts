import { Test, TestingModule } from '@nestjs/testing';
import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { JobsController } from './Jobs.controller';
import { ListJobsUseCase } from './use-cases/list-jobs.use-case';

describe('JobsController', () => {
  let controller: JobsController;
  let listJobsUseCase: ListJobsUseCase;

  const mockListJobsResponse = {
    data: [
      {
        id: 'job-1',
        title: 'Cozinheiro',
        description: 'Responsável pela preparação dos pratos',
        requirements: 'Experiência mínima de 2 anos',
        salary: new Prisma.Decimal('3000.00'),
        contractType: ContractType.CLT,
        status: JobStatus.ABERTA,
        restaurantId: 'restaurant-1',
        restaurant: {
          restaurantName: 'Restaurante Exemplo',
          logoUrl: 'https://example.com/logo.png',
        },
        createdAt: new Date(),
      },
    ],
    total: 1,
    skip: 0,
    take: 20,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: ListJobsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobsController>(JobsController);
    listJobsUseCase = module.get<ListJobsUseCase>(ListJobsUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call listJobsUseCase.execute with query params', async () => {
    const query = { skip: 0, take: 20 };

    jest
      .spyOn(listJobsUseCase, 'execute')
      .mockResolvedValue(mockListJobsResponse);

    const result = await controller.listJobs(query);

    expect(result).toBe(mockListJobsResponse);
    expect(listJobsUseCase.execute).toHaveBeenCalledWith(query);
  });

  it('should return paginated job feed', async () => {
    const query = { skip: 0, take: 5 };

    jest
      .spyOn(listJobsUseCase, 'execute')
      .mockResolvedValue({ ...mockListJobsResponse, take: 5 });

    const result = await controller.listJobs(query);

    expect(result.take).toBe(5);
    expect(result.data[0].restaurant.restaurantName).toBe(
      'Restaurante Exemplo',
    );
  });
});
