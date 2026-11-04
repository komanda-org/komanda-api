import { NotFoundException } from '@nestjs/common';
import { DenunciaTargetType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDenunciaUseCase } from './create-denuncia.use-case';

describe('CreateDenunciaUseCase', () => {
  let useCase: CreateDenunciaUseCase;
  let prisma: {
    denuncia: { create: jest.Mock };
    user: { findFirst: jest.Mock };
    job: { findFirst: jest.Mock };
  };

  const input = {
    authorId: 'author-1',
    targetType: DenunciaTargetType.VAGA,
    targetId: 'job-1',
    reason: 'Vaga com salário enganoso',
  };

  const created = {
    id: 'denuncia-1',
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    status: 'PENDENTE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = {
      denuncia: { create: jest.fn() },
      user: { findFirst: jest.fn() },
      job: { findFirst: jest.fn() },
    };
    useCase = new CreateDenunciaUseCase(prisma as unknown as PrismaService);
  });

  it('cria a denúncia com authorId do logado e sem setar status (default PENDENTE)', async () => {
    prisma.job.findFirst.mockResolvedValue({ id: 'job-1' });
    prisma.denuncia.create.mockResolvedValue(created);
    const selectArg = expect.objectContaining({
      status: true,
    }) as Record<string, unknown>;

    const result = (await useCase.execute(input)) as { status: string };

    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: { id: 'job-1', active: true, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.denuncia.create).toHaveBeenCalledWith({
      data: {
        authorId: 'author-1',
        targetType: DenunciaTargetType.VAGA,
        targetId: 'job-1',
        reason: 'Vaga com salário enganoso',
      },
      select: selectArg,
    });
    expect(result.status).toBe('PENDENTE');
  });

  it('valida PERFIL em users (ativo, não deletado)', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2' });
    prisma.denuncia.create.mockResolvedValue(created);

    await useCase.execute({
      ...input,
      targetType: DenunciaTargetType.PERFIL,
      targetId: 'user-2',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-2', active: true, deletedAt: null },
      select: { id: true },
    });
    expect(prisma.job.findFirst).not.toHaveBeenCalled();
  });

  it('retorna 404 quando a vaga não existe ou está inativa', async () => {
    prisma.job.findFirst.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.denuncia.create).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o perfil não existe ou está inativo', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...input,
        targetType: DenunciaTargetType.PERFIL,
        targetId: 'ghost',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.denuncia.create).not.toHaveBeenCalled();
  });

  it('MENSAGEM não valida alvo (sem tabela de chat no schema) e cria direto', async () => {
    prisma.denuncia.create.mockResolvedValue(created);

    await useCase.execute({
      ...input,
      targetType: DenunciaTargetType.MENSAGEM,
      targetId: 'msg-1',
    });

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.job.findFirst).not.toHaveBeenCalled();
    expect(prisma.denuncia.create).toHaveBeenCalled();
  });
});
