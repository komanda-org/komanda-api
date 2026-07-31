import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApplyToJobPostingUseCase } from './apply-to-job-posting.use-case';

// Mock tipado no lugar de `any`: só declaramos os métodos do Prisma que este
// use case realmente usa. Se ele passar a chamar outro método, o TS acusa.
type PrismaMock = {
  job: { findUnique: jest.Mock };
  candidatura: { create: jest.Mock };
};

describe('ApplyToJobPostingUseCase', () => {
  let useCase: ApplyToJobPostingUseCase;
  let prisma: PrismaMock;

  const VAGA_ID = 'job-1';
  const PROFISSIONAL_ID = 'professional-1';

  // `active` e `deletedAt` fazem parte do que o use case valida — sem eles no
  // mock, `vaga.active` chega como undefined e toda candidatura vira 422.
  const vagaAberta = {
    id: VAGA_ID,
    status: JobStatus.ABERTA,
    active: true,
    deletedAt: null,
  };

  // Espelha o model Candidatura atual (sem campo status — ver schema.prisma).
  const candidaturaCriada = {
    id: 'candidatura-1',
    jobId: VAGA_ID,
    professionalId: PROFISSIONAL_ID,
    createdAt: new Date('2026-07-10T12:00:00Z'),
    updatedAt: new Date('2026-07-10T12:00:00Z'),
  };

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError(code, {
      code,
      clientVersion: '7.0.0',
    });

  beforeEach(() => {
    prisma = {
      job: { findUnique: jest.fn() },
      candidatura: { create: jest.fn() },
    };

    // Um único cast na fronteira do mock — evita `any` espalhado pelo teste.
    useCase = new ApplyToJobPostingUseCase(prisma as unknown as PrismaService);
  });

  it('cria a candidatura mapeando vagaId/profissionalId para os campos do schema', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaAberta);
    prisma.candidatura.create.mockResolvedValue(candidaturaCriada);

    const result = await useCase.execute(VAGA_ID, PROFISSIONAL_ID);

    // O parâmetro chega em português; o schema usa jobId/professionalId (inglês).
    expect(prisma.candidatura.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { jobId: VAGA_ID, professionalId: PROFISSIONAL_ID },
      }),
    );
    expect(result).toBe(candidaturaCriada);
  });

  it('lança NotFoundException quando a vaga não existe', async () => {
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toThrow(
      NotFoundException,
    );
    // Não pode tentar candidatar se a vaga não existe.
    expect(prisma.candidatura.create).not.toHaveBeenCalled();
  });

  it('lança UnprocessableEntityException quando a vaga não está aberta', async () => {
    prisma.job.findUnique.mockResolvedValue({
      ...vagaAberta,
      status: JobStatus.ENCERRADA,
    });

    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.candidatura.create).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a vaga foi excluída logicamente', async () => {
    // `active` continua true de propósito: isola o deletedAt como causa do 404.
    prisma.job.findUnique.mockResolvedValue({
      ...vagaAberta,
      deletedAt: new Date('2026-07-20T10:00:00Z'),
    });

    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.candidatura.create).not.toHaveBeenCalled();
  });

  it('lança UnprocessableEntityException quando a vaga está inativa', async () => {
    // deletedAt null e status ABERTA: o 422 só pode ter vindo do `active`.
    prisma.job.findUnique.mockResolvedValue({ ...vagaAberta, active: false });

    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(prisma.candidatura.create).not.toHaveBeenCalled();
  });

  it('prioriza o 404 quando a vaga deletada também está encerrada', async () => {
    // Vaga removida raramente segue ABERTA. Se a guarda de existência escorregar
    // pra baixo da checagem de status, este é o único teste que acusa.
    prisma.job.findUnique.mockResolvedValue({
      ...vagaAberta,
      deletedAt: new Date('2026-07-20T10:00:00Z'),
      active: false,
      status: JobStatus.ENCERRADA,
    });

    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.candidatura.create).not.toHaveBeenCalled();
  });

  it('converte P2002 (candidatura duplicada) em ConflictException', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaAberta);
    prisma.candidatura.create.mockRejectedValue(prismaError('P2002'));

    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toThrow(
      ConflictException,
    );
  });

  it('repropaga erros que não sejam P2002', async () => {
    prisma.job.findUnique.mockResolvedValue(vagaAberta);
    const erro = prismaError('P2003');
    prisma.candidatura.create.mockRejectedValue(erro);

    // Erro inesperado não pode virar 409 — tem que subir como está.
    await expect(useCase.execute(VAGA_ID, PROFISSIONAL_ID)).rejects.toBe(erro);
  });
});
