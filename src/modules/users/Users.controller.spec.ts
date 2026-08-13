import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { UsersController } from './Users.controller';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';

describe('UsersController', () => {
  let controller: UsersController;
  let deleteAccountUseCase: DeleteAccountUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: DeleteAccountUseCase,
          useValue: { execute: jest.fn() },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    deleteAccountUseCase = module.get<DeleteAccountUseCase>(DeleteAccountUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('calls deleteAccountUseCase with the user id from the token', async () => {
    const req = { user: { id: 'user-1', role: Role.PROFISSIONAL } };
    const executeSpy = jest
      .spyOn(deleteAccountUseCase, 'execute')
      .mockResolvedValue();

    await controller.deleteAccount(req);

    expect(executeSpy).toHaveBeenCalledWith('user-1');
  });
});
