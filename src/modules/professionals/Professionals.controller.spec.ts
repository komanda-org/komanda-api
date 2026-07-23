import { Test, TestingModule } from '@nestjs/testing';
import { ProfessionalsController } from './Professionals.controller';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';

describe('ProfessionalsController', () => {
  let controller: ProfessionalsController;
  let registerProfessionalUseCase: RegisterProfessionalUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        {
          provide: RegisterProfessionalUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProfessionalsController>(ProfessionalsController);
    registerProfessionalUseCase = module.get<RegisterProfessionalUseCase>(
      RegisterProfessionalUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('registra o profissional delegando ao use case', async () => {
    const dto = {
      email: 'maria@example.com',
      senha: 'senha-super-secreta',
      nomeCompleto: 'Maria Souza',
      cargoPrincipal: 'Cozinheira',
    };

    const result = { id: 'professional-1' };

    const executeSpy = jest
      .spyOn(registerProfessionalUseCase, 'execute')
      .mockResolvedValue(result as never);

    expect(await controller.create(dto as never)).toBe(result);
    expect(executeSpy).toHaveBeenCalledWith(dto);
  });
});
