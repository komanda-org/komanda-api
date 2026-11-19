import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthCryptoService } from 'src/auth/auth-crypto.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProfessionalDto } from '../dto/create-professional.dto';
import { RegisterProfessionalUseCase } from './register-professional.use-case';

describe('RegisterProfessionalUseCase', () => {
  const dto: CreateProfessionalDto = {
    email: 'teste@komanda.com',
    password: 'senha12345',
    fullName: 'Maria Silva',
    mainRole: 'Garçonete',
  };

  function criarMockPrisma(
    overrides: Record<string, unknown> = {},
  ): PrismaService {
    const user = {
      id: 'user-id-123',
      email: dto.email,
      passwordHash: 'hashed-password',
      role: 'PROFISSIONAL',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      active: true,
    };

    const professional = {
      id: 'prof-id-123',
      userId: user.id,
      fullName: dto.fullName,
      mainRole: dto.mainRole,
      createdAt: new Date(),
      user,
    };

    const tx = {
      user: { create: jest.fn().mockResolvedValue(user) },
      professional: { create: jest.fn().mockResolvedValue(professional) },
    };

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
      ...overrides,
    };

    return prisma as unknown as PrismaService;
  }

  const mockAuth = {
    hash: jest.fn().mockResolvedValue('hashed-password'),
  } as unknown as AuthCryptoService;

  it('deve criar um profissional e retornar sem o passwordHash', async () => {
    const prisma = criarMockPrisma();
    const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

    const resultado = await useCase.execute(dto);

    expect(resultado).not.toHaveProperty('passwordHash');
    expect(resultado.email).toBe(dto.email);
    expect(resultado.role).toBe('PROFISSIONAL');
  });

  it('deve gravar e checar o email em minúsculas e sem espaços', async () => {
    const userCreate = jest.fn().mockResolvedValue({ id: 'user-id-123' });
    const tx = {
      user: { create: userCreate },
      professional: {
        create: jest.fn().mockResolvedValue({
          userId: 'user-id-123',
          fullName: dto.fullName,
          mainRole: dto.mainRole,
          createdAt: new Date(),
          user: { email: 'teste@x.com', role: 'PROFISSIONAL' },
        }),
      },
    };
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = criarMockPrisma({
      user: { findUnique },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        Promise.resolve(cb(tx)),
      ),
    });
    const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

    await useCase.execute({ ...dto, email: ' Teste@X.com ' });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'teste@x.com' },
    });
    const [[createArgs]] = userCreate.mock.calls as [
      [{ data: { email: string } }],
    ];
    expect(createArgs.data.email).toBe('teste@x.com');
  });

  it('deve lancar ConflictException quando o email ja existe (pre-checagem)', async () => {
    const prisma = criarMockPrisma({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'existente' }) },
    });
    const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deve lancar ConflictException em caso de race condition (P2002)', async () => {
    const p2002Error = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.8.0' },
    );

    const prisma = criarMockPrisma({
      $transaction: jest.fn(() => Promise.reject(p2002Error)),
    });
    const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

    await expect(useCase.execute(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('deve propagar erros desconhecidos sem engolir', async () => {
    const dbError = new Error('Erro inesperado no banco');

    const prisma = criarMockPrisma({
      $transaction: jest.fn(() => Promise.reject(dbError)),
    });
    const useCase = new RegisterProfessionalUseCase(prisma, mockAuth);

    await expect(useCase.execute(dto)).rejects.toThrow(
      'Erro inesperado no banco',
    );
  });
});
