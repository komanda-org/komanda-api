import { Test, TestingModule } from '@nestjs/testing';
import { DenunciaTargetType } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { DenunciasController } from './Denuncias.controller';
import { CreateDenunciaUseCase } from './use-cases/create-denuncia.use-case';

// O 401 sem token é do AuthGuard (já coberto pelos testes do guard);
// aqui garantimos só que o authorId vem do usuário logado, não do body.
describe('DenunciasController', () => {
  let controller: DenunciasController;
  let createDenuncia: { execute: jest.Mock };

  beforeEach(async () => {
    createDenuncia = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DenunciasController],
      providers: [{ provide: CreateDenunciaUseCase, useValue: createDenuncia }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get(DenunciasController);
  });

  it('cria com authorId = usuário logado, ignorando authorId do body', async () => {
    const dto = {
      targetType: DenunciaTargetType.PERFIL,
      targetId: 'user-2',
      reason: 'Suspeita de perfil falso',
    };
    createDenuncia.execute.mockResolvedValue({ id: 'denuncia-1' });

    await controller.create(dto, {
      user: { id: 'logged-user' },
    } as never);

    expect(createDenuncia.execute).toHaveBeenCalledWith({
      authorId: 'logged-user',
      targetType: DenunciaTargetType.PERFIL,
      targetId: 'user-2',
      reason: 'Suspeita de perfil falso',
    });
  });
});
