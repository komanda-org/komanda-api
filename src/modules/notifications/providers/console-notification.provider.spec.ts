import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConsoleNotificationProvider } from './console-notification.provider';

type PrismaMock = {
  notificacao: { create: jest.Mock; createMany: jest.Mock };
};

describe('ConsoleNotificationProvider', () => {
  let provider: ConsoleNotificationProvider;
  let prisma: PrismaMock;
  let log: jest.SpyInstance;

  beforeEach(() => {
    prisma = {
      notificacao: { create: jest.fn(), createMany: jest.fn() },
    };
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    provider = new ConsoleNotificationProvider(
      prisma as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('persiste a notificação mapeando para as colunas em português e loga', async () => {
      await provider.create({
        userId: 'user-1',
        title: 'Título',
        message: 'Mensagem',
      });

      expect(prisma.notificacao.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', titulo: 'Título', mensagem: 'Mensagem' },
      });
      expect(log).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    });

    it('corta o título no limite da coluna (200)', async () => {
      await provider.create({
        userId: 'user-1',
        title: 'x'.repeat(250),
        message: 'Mensagem',
      });

      expect(prisma.notificacao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ titulo: 'x'.repeat(200) }) as unknown,
      });
    });

    it('propaga erro do banco e não loga sucesso', async () => {
      prisma.notificacao.create.mockRejectedValue(new Error('db down'));

      await expect(
        provider.create({ userId: 'user-1', title: 'T', message: 'M' }),
      ).rejects.toThrow('db down');
      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('insere todas as notificações em um único createMany', async () => {
      prisma.notificacao.createMany.mockResolvedValue({ count: 2 });

      const count = await provider.createMany([
        { userId: 'prof-1', title: 'T', message: 'M' },
        { userId: 'prof-2', title: 'T', message: 'M' },
      ]);

      expect(count).toBe(2);
      expect(prisma.notificacao.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.notificacao.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'prof-1', titulo: 'T', mensagem: 'M' },
          { userId: 'prof-2', titulo: 'T', mensagem: 'M' },
        ],
      });
      expect(log).toHaveBeenCalled();
    });

    it('lista vazia devolve 0 sem tocar no banco', async () => {
      const count = await provider.createMany([]);

      expect(count).toBe(0);
      expect(prisma.notificacao.createMany).not.toHaveBeenCalled();
    });
  });

  describe('notifyNewMessage (chat)', () => {
    it('gera exatamente 1 notificação, para o destinatário', async () => {
      await provider.notifyNewMessage({
        recipientId: 'destinatario-1',
        senderName: 'Cantina da Nonna',
        preview: 'Olá! Podemos conversar sobre a vaga?',
      });

      expect(prisma.notificacao.create).toHaveBeenCalledTimes(1);
      expect(prisma.notificacao.create).toHaveBeenCalledWith({
        data: {
          userId: 'destinatario-1',
          titulo: 'Nova mensagem de Cantina da Nonna',
          mensagem: 'Olá! Podemos conversar sobre a vaga?',
        },
      });
      // O contrato não recebe o remetente: não há como notificá-lo por engano.
      expect(prisma.notificacao.createMany).not.toHaveBeenCalled();
    });

    it('propaga erro do banco para o chamador decidir (não engole)', async () => {
      prisma.notificacao.create.mockRejectedValue(new Error('db down'));

      await expect(
        provider.notifyNewMessage({
          recipientId: 'destinatario-1',
          senderName: 'Cantina da Nonna',
          preview: 'Oi',
        }),
      ).rejects.toThrow('db down');
      expect(log).not.toHaveBeenCalled();
    });

    it('corta o título em 200 chars quando o senderName é longo', async () => {
      const prefixo = 'Nova mensagem de ';
      const senderName = 'N'.repeat(300);

      await provider.notifyNewMessage({
        recipientId: 'destinatario-1',
        senderName,
        preview: 'Oi',
      });

      const tituloEsperado = (prefixo + senderName).slice(0, 200);
      expect(tituloEsperado).toHaveLength(200);
      expect(prisma.notificacao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ titulo: tituloEsperado }) as unknown,
      });
    });
  });
});
