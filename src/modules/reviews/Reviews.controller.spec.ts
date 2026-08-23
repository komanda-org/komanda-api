import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { UsersController } from './Users.controller';
import { ListAvaliacoesRecebidasUseCase } from './use-cases/list-avaliacoes-recebidas.use-case';

describe('UsersController', () => {
  let controller: UsersController;
  let listAvaliacoesRecebidasUseCase: ListAvaliacoesRecebidasUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: ListAvaliacoesRecebidasUseCase,
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

    controller = module.get<UsersController>(UsersController);
    listAvaliacoesRecebidasUseCase = module.get<ListAvaliacoesRecebidasUseCase>(
      ListAvaliacoesRecebidasUseCase,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lista as avaliações recebidas usando o id da rota e os filtros da query', async () => {
    const response = {
      data: [],
      total: 0,
      skip: 10,
      take: 5,
      mediaNotas: null,
    };

    const executeSpy = jest
      .spyOn(listAvaliacoesRecebidasUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listAvaliacoesRecebidas('user-1', {
      skip: 10,
      take: 5,
    });

    expect(executeSpy).toHaveBeenCalledWith({
      usuarioId: 'user-1',
      skip: 10,
      take: 5,
    });
    expect(result).toBe(response);
  });

  it('usa skip/take padrão quando a query não informa', async () => {
    const response = {
      data: [],
      total: 0,
      skip: 0,
      take: 20,
      mediaNotas: null,
    };

    const executeSpy = jest
      .spyOn(listAvaliacoesRecebidasUseCase, 'execute')
      .mockResolvedValue(response);

    const result = await controller.listAvaliacoesRecebidas('user-2', {});

    expect(executeSpy).toHaveBeenCalledWith({
      usuarioId: 'user-2',
      skip: undefined,
      take: undefined,
    });
    expect(result).toBe(response);
  });
});
