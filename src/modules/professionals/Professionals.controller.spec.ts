import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { ProfessionalsController } from './Professionals.controller';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';
import { SearchProfessionalsUseCase } from './use-cases/search-professionals.use-case';

describe('ProfessionalsController', () => {
  let controller: ProfessionalsController;
  let registerProfessionalUseCase: RegisterProfessionalUseCase;
  let searchProfessionalsUseCase: SearchProfessionalsUseCase;

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
        {
          provide: SearchProfessionalsUseCase,
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

    controller = module.get<ProfessionalsController>(ProfessionalsController);
    registerProfessionalUseCase = module.get<RegisterProfessionalUseCase>(
      RegisterProfessionalUseCase,
    );
    searchProfessionalsUseCase = module.get<SearchProfessionalsUseCase>(
      SearchProfessionalsUseCase,
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

  it('busca profissionais delegando ao use case', async () => {
    const query = { position: 'Cozinheiro', skip: 0, take: 20 };
    const result = { data: [], total: 0, skip: 0, take: 20 };

    const executeSpy = jest
      .spyOn(searchProfessionalsUseCase, 'execute')
      .mockResolvedValue(result);

    expect(await controller.search(query as never)).toBe(result);
    expect(executeSpy).toHaveBeenCalledWith(query);
  });
});
