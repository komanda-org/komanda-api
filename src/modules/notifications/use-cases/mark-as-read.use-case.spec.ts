import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarkAsReadUseCase } from './mark-as-read.use-case';

type PrismaMock = {
  notificacao: { findUnique: jest.Mock; update: jest.Mock };
};

describe('MarkAsReadUseCase', () => {
  let useCase: MarkAsReadUseCase;
  let prisma: PrismaMock;

  const createdAt = new Date('2026-01-01T12:00:00Z');
  const notificacao = {
    id: 'notif-1',
    titulo: 'Nova vaga perto de você: Chef',
    mensagem: 'Cantina da Nonna publicou a vaga "Chef".',
    lida: false,
    userId: 'user-1',
    createdAt,
  };

  beforeEach(() => {
    prisma = {
      notificacao: { findUnique: jest.fn(), update: jest.fn() },
    };
    useCase = new MarkAsReadUseCase(prisma as unknown as PrismaService);
  });

  it('marca como lida e devolve o DTO em inglês', async () => {
    prisma.notificacao.findUnique.mockResolvedValue(notificacao);
    prisma.notificacao.update.mockResolvedValue({ ...notificacao, lida: true });

    const result = await useCase.execute({ id: 'notif-1', userId: 'user-1' });

    expect(prisma.notificacao.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { lida: true },
    });
    expect(result).toEqual({
      id: 'notif-1',
      title: notificacao.titulo,
      message: notificacao.mensagem,
      read: true,
      createdAt,
    });
  });

  it('lança NotFoundException quando a notificação não existe', async () => {
    prisma.notificacao.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'inexistente', userId: 'user-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.notificacao.update).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException quando a notificação é de outro usuário', async () => {
    prisma.notificacao.findUnique.mockResolvedValue(notificacao);

    await expect(
      useCase.execute({ id: 'notif-1', userId: 'outro-user' }),
    ).rejects.toThrow(ForbiddenException);
    // Não pode marcar como lida a notificação alheia.
    expect(prisma.notificacao.update).not.toHaveBeenCalled();
  });
});
