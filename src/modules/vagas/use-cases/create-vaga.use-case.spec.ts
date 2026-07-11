import { NotFoundException } from '@nestjs/common';
import { ContractType, JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVagaUseCase } from './create-vaga.use-case';

// Mock tipado no lugar de `any`: só declaramos os métodos do Prisma que este
// use case realmente usa. Se ele passar a chamar outro método, o TS acusa.
type PrismaMock = {
  restaurant: { findUnique: jest.Mock };
  job: { create: jest.Mock };
};

describe('CreateVagaUseCase', () => {
  let useCase: CreateVagaUseCase;
  let prisma: PrismaMock;

  const restauranteId = 'restaurant-1';

  const input = {
    titulo: 'Chef de Cozinha',
    descricao: 'Vaga para chef com experiência em cozinha italiana e gestão.',
    requisitos: 'Experiência prévia e liderança.',
    salario: 4500,
    tipoContrato: ContractType.CLT,
    restauranteId,
  };

  const restauranteAtivo = {
    userId: restauranteId,
    active: true,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      restaurant: { findUnique: jest.fn() },
      job: { create: jest.fn() },
    };

    // Um único cast na fronteira do mock — evita `any` espalhado pelo teste.
    useCase = new CreateVagaUseCase(prisma as unknown as PrismaService);
  });

  it('cria a vaga e mapeia o VagaResponseDto', async () => {
    const createdAt = new Date('2026-01-01T12:00:00Z');
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      title: input.titulo,
      description: input.descricao,
      requirements: input.requisitos,
      // O Prisma devolve Decimal, não number — é isso que o `.toNumber()` trata.
      salary: new Prisma.Decimal('4500.00'),
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      restaurantId: restauranteId,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      active: true,
    });

    const result = await useCase.execute(input);

    expect(result).toEqual({
      id: 'job-1',
      titulo: input.titulo,
      descricao: input.descricao,
      requisitos: input.requisitos,
      salario: 4500,
      tipoContrato: ContractType.CLT,
      status: JobStatus.ABERTA,
      restauranteId,
      createdAt,
    });

    // salario chega como number puro (e não como Decimal) para o consumidor.
    expect(typeof result.salario).toBe('number');
    // Campos internos não podem vazar na resposta.
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('deletedAt');
    expect(result).not.toHaveProperty('active');
  });

  it('grava restaurantId vindo do token, nunca do body', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      title: input.titulo,
      description: input.descricao,
      requirements: null,
      salary: null,
      contractType: ContractType.CLT,
      status: JobStatus.ABERTA,
      restaurantId: restauranteId,
      createdAt: new Date(),
    });

    await useCase.execute(input);

    expect(prisma.job.create).toHaveBeenCalledWith({
      data: {
        title: input.titulo,
        description: input.descricao,
        requirements: input.requisitos,
        salary: input.salario,
        contractType: ContractType.CLT,
        restaurantId: restauranteId,
      },
    });
  });

  it('devolve requisitos e salario como undefined quando vierem nulos', async () => {
    prisma.restaurant.findUnique.mockResolvedValue(restauranteAtivo);
    prisma.job.create.mockResolvedValue({
      id: 'job-2',
      title: input.titulo,
      description: input.descricao,
      requirements: null,
      salary: null,
      contractType: ContractType.FREELANCER,
      status: JobStatus.ABERTA,
      restaurantId: restauranteId,
      createdAt: new Date(),
    });

    const result = await useCase.execute({
      ...input,
      requisitos: undefined,
      salario: undefined,
      tipoContrato: ContractType.FREELANCER,
    });

    expect(result.requisitos).toBeUndefined();
    expect(result.salario).toBeUndefined();
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
});
