import { Test, TestingModule } from '@nestjs/testing';
import { ContractType, Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { VagasController } from './vagas.controller';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';

describe('VagasController', () => {
  let controller: VagasController;
  let createVagaUseCase: CreateVagaUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VagasController],
      providers: [
        {
          provide: CreateVagaUseCase,
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

    controller = module.get<VagasController>(VagasController);
    createVagaUseCase = module.get<CreateVagaUseCase>(CreateVagaUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createVagaUseCase.execute with mapped payload', async () => {
    const dto = {
      titulo: 'Chef de Cozinha',
      descricao: 'Vaga para chef com experiência em cozinha italiana e gestão de equipe.',
      requisitos: 'Experiência prévia, liderança e disponibilidade de horário.',
      salario: 4500,
      tipoContrato: ContractType.CLT,
    };

    const req = {
      user: {
        id: 'restaurant-1',
        role: Role.RESTAURANTE,
      },
    };

    const result = { id: 'job-1' };
    jest.spyOn(createVagaUseCase, 'execute').mockResolvedValue(result as never);

    expect(await controller.Create(dto, req)).toBe(result);
    expect(createVagaUseCase.execute).toHaveBeenCalledWith({
      titulo: dto.titulo,
      descricao: dto.descricao,
      requisitos: dto.requisitos,
      salario: dto.salario,
      tipoContrato: dto.tipoContrato,
      restauranteId: req.user.id,
    });
  });
});