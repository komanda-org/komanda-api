import { Logger, NotFoundException } from '@nestjs/common';
import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { INotificacaoService } from 'src/modules/notifications/interfaces/notification-service.interface';
import { CreateJobPostingUseCase } from './create-job-posting.use-case';

// Mock tipado no lugar de `any`: só declaramos os métodos do Prisma que este
// use case realmente usa. Se ele passar a chamar outro método, o TS acusa.
type PrismaMock = {
  restaurant: { findUnique: jest.Mock };
  job: { create: jest.Mock };
  professional: { findMany: jest.Mock };
};

type NotificacaoServiceMock = {
  [K in keyof INotificacaoService]: jest.Mock;
};

describe('CreateJobPostingUseCase', () => {
  let useCase: CreateJobPostingUseCase;
  let prisma: PrismaMock;
  let notificacaoService: NotificacaoServiceMock;

  const restaurantId = 'restaurant-1';

  const input = {
    title: 'Chef de Cozinha',
    description: 'Vaga para chef com experiência em cozinha italiana e gestão.',
    requirements: 'Experiência prévia e liderança.',
    salary: 4500,
    contractType: ContractType.CLT,
    restaurantId,
  };

  const restauranteAtivo = {
    userId: restaurantId,
    active: true,
    deletedAt: null,
    restaurantName: 'Cantina da Nonna',
    zipCode: '01310-100',
  };

  beforeEach(() => {
    prisma = {
      restaurant: { findUnique: jest.fn() },
      job: { create: jest.fn() },
      // Padrão: ninguém compatível — os testes de notificação sobrescrevem.
      professional: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notificacaoService = {
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue(0),
      notifyNewMessage: jest.fn(),
    };

    // Um único cast na fronteira do mock — evita `any` espalhado pelo teste.
    useCase = new CreateJobPostingUseCase(
      prisma as unknown as PrismaService,
      notificacaoService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cria a vaga e mapeia o JobPostingResponseDto', async () => {
    const createdAt = new Date('2026-01-01T12:00:00Z');
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      // O Prisma devolve Decimal, não number — é isso que o `.toNumber()` trata.
      salary: new Prisma.Decimal('4500.00'),
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      restaurantId,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      active: true,
    });

    const result = await useCase.execute(input);

    expect(result).toEqual({
      id: 'job-1',
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      salary: 4500,
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      restaurantId,
      createdAt,
    });

    // salario chega como number puro (e não como Decimal) para o consumidor.
    expect(typeof result.salary).toBe('number');
    // Campos internos não podem vazar na resposta.
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('active');
  });

  it('grava restaurantId vindo do token, nunca do body', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      title: input.title,
      description: input.description,
      requirements: null,
      salary: null,
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      restaurantId,
      createdAt: new Date(),
    });

    await useCase.execute(input);

    expect(prisma.job.create).toHaveBeenCalledWith({
      data: {
        title: input.title,
        description: input.description,
        requirements: input.requirements,
        salary: input.salary,
        contractType: ContractType.CLT,
        restaurantId,
      },
    });
  });

  it('devolve requisitos e salario como undefined quando vierem nulos', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockResolvedValue({
      id: 'job-2',
      title: input.title,
      description: input.description,
      requirements: null,
      salary: null,
      contractType: ContractType.FREELANCER,
      status: JobStatus.ABERTA,
      restaurantId,
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      ...input,
      requirements: undefined,
      salary: undefined,
      contractType: ContractType.FREELANCER,
    });

    expect(result.requirements).toBeUndefined();
    expect(result.salary).toBeUndefined();
  });

  it('lança NotFoundException quando o restaurante não existe', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
    // Não pode tentar escrever se o restaurante não existe.
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o restaurante está inativo', async () => {
    prisma.restaurant.findUnique.mockResolvedValue({
      ...restauranteAtivo,
      active: false,
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o restaurante foi excluído logicamente', async () => {
    prisma.restaurant.findUnique.mockResolvedValue({
      ...restauranteAtivo,
      deletedAt: new Date(),
    });

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('converte P2003 (corrida na FK) em NotFoundException', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('FK constraint failed', {
        code: 'P2003',
        clientVersion: '7.0.0',
      }),
    );

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundException);
  });

  it('repropaga erros que não sejam P2003', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    const erro = new Prisma.PrismaClientKnownRequestError('unique violation', {
      code: 'P2002',
      clientVersion: '7.0.0',
    });
    prisma.job.create.mockRejectedValue(erro);

    // Erro inesperado não pode virar 404 — tem que subir como está (500).
    await expect(useCase.execute(input)).rejects.toBe(erro);
  });
  describe('notificação de profissionais compatíveis (RF08)', () => {
    const vagaCriada = {
      id: 'job-1',
      title: input.title,
      description: input.description,
      requirements: null,
      salary: null,
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      restaurantId,
      createdAt: new Date(),
    };

    it('notifica só os profissionais devolvidos pela busca por prefixo de CEP', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
      prisma.job.create.mockResolvedValue(vagaCriada);
      prisma.professional.findMany.mockResolvedValue([
        { userId: 'prof-1' },
        { userId: 'prof-2' },
      ]);

      await useCase.execute(input);

      expect(notificacaoService.createMany).toHaveBeenCalledTimes(1);
      expect(notificacaoService.createMany).toHaveBeenCalledWith([
        {
          userId: 'prof-1',
          title: `Nova vaga perto de você: ${input.title}`,
          message: `Cantina da Nonna publicou a vaga "${input.title}".`,
        },
        {
          userId: 'prof-2',
          title: `Nova vaga perto de você: ${input.title}`,
          message: `Cantina da Nonna publicou a vaga "${input.title}".`,
        },
      ]);
    });

    it('busca em uma única query, excluindo soft-deleted/inativos e o dono da vaga', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
      prisma.job.create.mockResolvedValue(vagaCriada);

      await useCase.execute(input);

      expect(prisma.professional.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.professional.findMany).toHaveBeenCalledWith({
        where: {
          // '01310-100' normalizado para os 5 primeiros dígitos.
          zipCode: { startsWith: '01310' },
          active: true,
          deletedAt: null,
          user: { active: true, deletedAt: null },
          userId: { not: restaurantId },
        },
        select: { userId: true },
      });
    });

    it('normaliza CEP do restaurante sem hífen ou com espaços', async () => {
      prisma.restaurant.findUnique.mockResolvedValue({
        ...restauranteAtivo,
        zipCode: ' 04538 133 ',
      });
      prisma.job.create.mockResolvedValue(vagaCriada);

      await useCase.execute(input);

      expect(prisma.professional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            zipCode: { startsWith: '04538' },
          }) as unknown,
        }),
      );
    });

    it('lista vazia de compatíveis não quebra e devolve a vaga', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
      prisma.job.create.mockResolvedValue(vagaCriada);
      prisma.professional.findMany.mockResolvedValue([]);

      const result = await useCase.execute(input);

      expect(result.id).toBe('job-1');
      expect(notificacaoService.createMany).toHaveBeenCalledWith([]);
    });

    it('CEP do restaurante inválido: não busca nem notifica, mas cria a vaga', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      prisma.restaurant.findUnique.mockResolvedValue({
        ...restauranteAtivo,
        zipCode: '123',
      });
      prisma.job.create.mockResolvedValue(vagaCriada);

      const result = await useCase.execute(input);

      expect(result.id).toBe('job-1');
      expect(prisma.professional.findMany).not.toHaveBeenCalled();
      expect(notificacaoService.createMany).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('job-1'));
    });

    it('falha no provider não impede criar a vaga e é logada com contexto', async () => {
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
      prisma.job.create.mockResolvedValue(vagaCriada);
      prisma.professional.findMany.mockResolvedValue([{ userId: 'prof-1' }]);
      notificacaoService.createMany.mockRejectedValue(new Error('db down'));

      const result = await useCase.execute(input);

      expect(result.id).toBe('job-1');
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('job-1'),
        expect.any(String),
      );
    });

    it('falha na busca de compatíveis também não impede criar a vaga', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
      prisma.job.create.mockResolvedValue(vagaCriada);
      prisma.professional.findMany.mockRejectedValue(new Error('timeout'));

      await expect(useCase.execute(input)).resolves.toMatchObject({
        id: 'job-1',
      });
      expect(notificacaoService.createMany).not.toHaveBeenCalled();
    });

    it('não notifica ninguém se a vaga não foi criada', async () => {
      prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
      prisma.job.create.mockRejectedValue(new Error('falha no insert'));

      await expect(useCase.execute(input)).rejects.toThrow('falha no insert');
      expect(prisma.professional.findMany).not.toHaveBeenCalled();
      expect(notificacaoService.createMany).not.toHaveBeenCalled();
    });
  });
});
