import { Test, TestingModule } from '@nestjs/testing';
import { CandidaturaStatus, Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { ApplicationStatusController } from './application-status.controller';
import { UpdateApplicationStatusUseCase } from './use-cases/update-application-status.use-case';

describe('ApplicationStatusController', () => {
  let controller: ApplicationStatusController;
  let updateApplicationStatusUseCase: UpdateApplicationStatusUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationStatusController],
      providers: [
        {
          provide: UpdateApplicationStatusUseCase,
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

    controller = module.get<ApplicationStatusController>(
      ApplicationStatusController,
    );
    updateApplicationStatusUseCase = module.get<UpdateApplicationStatusUseCase>(
      UpdateApplicationStatusUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('atualiza o status usando o restaurante do token e mapeia a resposta', async () => {
    const createdAt = new Date('2026-07-10T12:00:00Z');
    const updatedAt = new Date('2026-07-29T09:00:00Z');
    const req = {
      user: { id: 'restaurant-1', role: Role.RESTAURANTE },
    };

    const executeSpy = jest
      .spyOn(updateApplicationStatusUseCase, 'execute')
      .mockResolvedValue({
        id: 'candidatura-1',
        jobId: 'job-1',
        professionalId: 'professional-1',
        status: CandidaturaStatus.APROVADA,
        createdAt,
        updatedAt,
      });

    const result = await controller.updateStatus(
      'job-1',
      'candidatura-1',
      { status: CandidaturaStatus.APROVADA },
      req,
    );

    // O id do restaurante tem que sair do token, nunca do body ou da rota.
    expect(executeSpy).toHaveBeenCalledWith({
      vagaId: 'job-1',
      candidaturaId: 'candidatura-1',
      restauranteId: 'restaurant-1',
      status: CandidaturaStatus.APROVADA,
    });
    expect(result).toEqual({
      id: 'candidatura-1',
      vagaId: 'job-1',
      profissionalId: 'professional-1',
      status: CandidaturaStatus.APROVADA,
      createdAt,
      updatedAt,
    });
  });
});
