import { CandidaturaStatus } from '@prisma/client';
import {
  JobEventNotifier,
  MESSAGE_PREVIEW_MAX,
  messagePreview,
} from './job-event-notifier';

describe('JobEventNotifier', () => {
  const createService = () => ({
    create: jest.fn().mockResolvedValue(undefined),
    createMany: jest.fn().mockResolvedValue(0),
    notifyNewMessage: jest.fn().mockResolvedValue(undefined),
  });

  let service: ReturnType<typeof createService>;
  let notifier: JobEventNotifier;

  beforeEach(() => {
    service = createService();
    notifier = new JobEventNotifier(service);
  });

  it('candidatura nova avisa o restaurante', async () => {
    await notifier.newApplication({
      restaurantId: 'rest-1',
      jobTitle: 'Garçom',
      professionalName: 'Marina Souza',
    });

    expect(service.create).toHaveBeenCalledWith({
      userId: 'rest-1',
      title: 'Nova candidatura: Garçom',
      message: 'Marina Souza se candidatou à vaga "Garçom".',
    });
  });

  it('aprovação avisa que o chat foi liberado', async () => {
    await notifier.applicationDecided({
      professionalId: 'prof-1',
      jobTitle: 'Garçom',
      restaurantName: 'Maré Alta',
      status: CandidaturaStatus.APROVADA,
    });

    expect(service.create).toHaveBeenCalledWith({
      userId: 'prof-1',
      title: 'Candidatura aprovada: Garçom',
      message:
        'Maré Alta aprovou sua candidatura. O chat com o restaurante já está liberado.',
    });
  });

  it('rejeição avisa com texto neutro', async () => {
    await notifier.applicationDecided({
      professionalId: 'prof-1',
      jobTitle: 'Garçom',
      restaurantName: 'Maré Alta',
      status: CandidaturaStatus.REJEITADA,
    });

    expect(service.create).toHaveBeenCalledWith({
      userId: 'prof-1',
      title: 'Candidatura não aprovada: Garçom',
      message: 'Maré Alta seguiu com outros candidatos para a vaga "Garçom".',
    });
  });

  it('PENDENTE não gera aviso', async () => {
    await notifier.applicationDecided({
      professionalId: 'prof-1',
      jobTitle: 'Garçom',
      restaurantName: 'Maré Alta',
      status: CandidaturaStatus.PENDENTE,
    });

    expect(service.create).not.toHaveBeenCalled();
  });

  it('vaga encerrada avisa todos os pendentes num lote só', async () => {
    await notifier.pendingClosedWithJob({
      professionalIds: ['prof-1', 'prof-2'],
      jobTitle: 'Garçom',
      restaurantName: 'Maré Alta',
    });

    expect(service.createMany).toHaveBeenCalledTimes(1);
    expect(service.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'prof-1',
        title: 'Vaga encerrada: Garçom',
      }),
      expect.objectContaining({
        userId: 'prof-2',
        title: 'Vaga encerrada: Garçom',
      }),
    ]);
  });

  it('mensagem nova usa a prévia do texto para cada destinatário', async () => {
    await notifier.newMessage({
      recipientIds: ['prof-1', 'prof-2'],
      senderName: 'Maré Alta',
      content: '  Pode   começar\nsegunda?  ',
    });

    expect(service.notifyNewMessage).toHaveBeenCalledTimes(2);
    expect(service.notifyNewMessage).toHaveBeenCalledWith({
      recipientId: 'prof-1',
      senderName: 'Maré Alta',
      preview: 'Pode começar segunda?',
    });
  });

  it('falha ao gravar a notificação não quebra quem chamou', async () => {
    service.create.mockRejectedValue(new Error('banco fora'));

    await expect(
      notifier.newApplication({
        restaurantId: 'rest-1',
        jobTitle: 'Garçom',
        professionalName: 'Marina Souza',
      }),
    ).resolves.toBeUndefined();
  });

  it('prévia longa é cortada com reticências', () => {
    const preview = messagePreview('a'.repeat(500));

    expect(preview).toHaveLength(MESSAGE_PREVIEW_MAX);
    expect(preview.endsWith('…')).toBe(true);
  });
});
