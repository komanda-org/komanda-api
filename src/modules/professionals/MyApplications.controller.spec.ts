import { Test, TestingModule } from '@nestjs/testing';
import { CandidaturaStatus, Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { MyApplicationsController } from './MyApplications.controller';
import { ListMyApplicationsUseCase } from './use-cases/list-my-applications.use-case';

describe('MyApplicationsController', () => {
  let controller: MyApplicationsController;
  let listMyApplicationsUseCase: ListMyApplicationsUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyApplicationsController],
      providers: [
        {
          provide: ListMyApplicationsUseCase,
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

    controller = module.get<MyApplicationsController>(MyApplicationsController);
    listMyApplicationsUseCase = module.get<ListMyApplicationsUseCase>(
      ListMyApplicationsUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lista o histórico usando o profissional do token e os filtros da query', async () => {
    const req = {
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
    };

    const response = {
      data: [],
      total: 0,
      skip: 10,
      take: 5,
    };

    const executeSpy = jest
      .spyOn(listMyApplicationsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listMyApplications(
      { status: CandidaturaStatus.APROVADA, skip: 10, take: 5 },
      req,
    );

    // O professionalId nunca pode vir da query ou do body, só do token.
    expect(executeSpy).toHaveBeenCalledWith({
      professionalId: 'professional-1',
      status: CandidaturaStatus.APROVADA,
      skip: 10,
      take: 5,
    });
    expect(result).toBe(response);
  });

  it('lista o histórico sem filtro de status quando a query não informa', async () => {
    const req = {
      user: { id: 'professional-2', role: Role.PROFISSIONAL },
    };

    const response = { data: [], total: 0, skip: 0, take: 20 };

    const executeSpy = jest
      .spyOn(listMyApplicationsUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listMyApplications({}, req);

    expect(executeSpy).toHaveBeenCalledWith({
      professionalId: 'professional-2',
      status: undefined,
      skip: undefined,
      take: undefined,
    });
    expect(result).toBe(response);
  });
});
