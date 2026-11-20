import { Test, TestingModule } from '@nestjs/testing';
import { ContractType, JobStatus } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { JobsController } from './Jobs.controller';
import { GetJobByIdUseCase } from './use-cases/get-job-by-id.use-case';
import { SearchJobsUseCase } from './use-cases/search-jobs.use-case';

describe('JobsController', () => {
  let controller: JobsController;
  let searchJobsUseCase: SearchJobsUseCase;

  const mockListJobsResponse = {
    data: [
      {
        id: 'job-1',
        title: 'Cozinheiro',
        description: 'Responsável pela preparação dos pratos',
        requirements: 'Experiência mínima de 2 anos',
        salary: '3000.00',
        contractType: ContractType.CLT,
        shift: 'NOITE',
        status: JobStatus.ABERTA,
        urgent: false,
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
          provide: SearchJobsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: GetJobByIdUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JobsController>(JobsController);
    searchJobsUseCase = module.get<SearchJobsUseCase>(SearchJobsUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call searchJobsUseCase.execute for the default job feed', async () => {
    const query = { skip: 0, take: 20 };

    jest
      .spyOn(searchJobsUseCase, 'execute')
      .mockResolvedValue(mockListJobsResponse);

    const result = await controller.listJobs(query);

    expect(result).toBe(mockListJobsResponse);
    expect(searchJobsUseCase.execute).toHaveBeenCalledWith(query);
  });

  it('should forward the shift filter from GET /jobs to the use case', async () => {
    const executeSpy = jest
      .spyOn(searchJobsUseCase, 'execute')
      .mockResolvedValue(mockListJobsResponse);

    await controller.listJobs({ shift: 'NOITE', skip: 0, take: 20 });

    expect(executeSpy).toHaveBeenCalledWith({
      shift: 'NOITE',
      skip: 0,
      take: 20,
    });
  });

  it('should return paginated job feed', async () => {
    const query = { skip: 0, take: 5 };

    jest
      .spyOn(searchJobsUseCase, 'execute')
      .mockResolvedValue({ ...mockListJobsResponse, take: 5 });

    const result = await controller.listJobs(query);

    expect(result.take).toBe(5);
    expect(result.data[0].restaurant.restaurantName).toBe(
      'Restaurante Exemplo',
    );
  });

  it('should call searchJobsUseCase.execute with search query params', async () => {
    const query = {
      query: 'chef',
      contractType: ContractType.CLT,
      minSalary: 4000,
      skip: 0,
      take: 10,
    };

    jest
      .spyOn(searchJobsUseCase, 'execute')
      .mockResolvedValue(mockListJobsResponse);

    const result = await controller.searchJobs(query);

    expect(result).toBe(mockListJobsResponse);
    expect(searchJobsUseCase.execute).toHaveBeenCalledWith(query);
  });
});
