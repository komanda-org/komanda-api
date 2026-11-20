import { NotFoundException } from '@nestjs/common';
import {
  CandidaturaStatus,
  ContractType,
  JobStatus,
  Prisma,
  Role,
  JobShift,
} from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { PUBLIC_RESTAURANT_SELECT } from '../job.mapper';
import { GetJobByIdUseCase } from './get-job-by-id.use-case';

const PROF = { id: 'prof-1', role: Role.PROFISSIONAL };
const OWNER = { id: 'restaurant-1', role: Role.RESTAURANTE };
const OTHER_RESTAURANT = { id: 'restaurant-2', role: Role.RESTAURANTE };

const application = {
  id: 'app-1',
  status: CandidaturaStatus.PENDENTE,
  createdAt: new Date('2026-11-18T12:00:00Z'),
};

const jobRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  title: 'Garçom',
  description: 'Atendimento no salão em eventos e jantares',
  requirements: 'Experiência de 1 ano',
  salary: new Prisma.Decimal('2200.50'),
  contractType: ContractType.CLT,
  shifts: [JobShift.NOITE],
  status: JobStatus.ABERTA,
  urgent: true,
  restaurantId: 'restaurant-1',
  active: true,
  deletedAt: null,
  closedAt: null,
  createdAt: new Date('2026-11-18T10:00:00Z'),
  updatedAt: new Date('2026-11-18T10:00:00Z'),
  restaurant: {
    restaurantName: 'Cantina Bella Massa',
    logoUrl: null,
    cuisineType: 'Italiana',
    averageRating: 4.5,
    address: 'Rua das Flores, 100',
    zipCode: '45820-020',
  },
  candidaturas: [],
  ...overrides,
});

describe('GetJobByIdUseCase', () => {
  let prisma: { job: { findFirst: jest.Mock } };
  let useCase: GetJobByIdUseCase;

  beforeEach(() => {
    prisma = { job: { findFirst: jest.fn() } };
    useCase = new GetJobByIdUseCase(prisma as unknown as PrismaService);
  });

  it('consulta uma vez, filtrando vaga ativa e dono não excluído', async () => {
    prisma.job.findFirst.mockResolvedValue(jobRow());

    await useCase.execute('job-1', PROF);

    expect(prisma.job.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.job.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'job-1',
        active: true,
        deletedAt: null,
        restaurant: { deletedAt: null, user: { deletedAt: null } },
      },
      include: {
        restaurant: { select: PUBLIC_RESTAURANT_SELECT },
        candidaturas: {
          where: { professionalId: 'prof-1' },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
    });
  });

  it('vaga ABERTA sem candidatura: formato da lista + hasApplied false', async () => {
    prisma.job.findFirst.mockResolvedValue(jobRow());

    const result = await useCase.execute('job-1', PROF);

    expect(result).toEqual({
      id: 'job-1',
      title: 'Garçom',
      description: 'Atendimento no salão em eventos e jantares',
      requirements: 'Experiência de 1 ano',
      salary: '2200.5',
      contractType: ContractType.CLT,
      shifts: [JobShift.NOITE],
      status: JobStatus.ABERTA,
      urgent: true,
      restaurantId: 'restaurant-1',
      restaurant: {
        restaurantName: 'Cantina Bella Massa',
        logoUrl: null,
        cuisineType: 'Italiana',
        averageRating: 4.5,
        address: 'Rua das Flores, 100',
        zipCode: '45820-020',
      },
      createdAt: new Date('2026-11-18T10:00:00Z'),
      hasApplied: false,
      application: null,
    });
  });

  it('não expõe cnpj, telefone nem campos internos', async () => {
    prisma.job.findFirst.mockResolvedValue(jobRow());

    const result = await useCase.execute('job-1', PROF);

    expect(PUBLIC_RESTAURANT_SELECT).not.toHaveProperty('cnpj');
    expect(PUBLIC_RESTAURANT_SELECT).not.toHaveProperty('phone');
    for (const field of ['active', 'deletedAt', 'closedAt', 'candidaturas']) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it('profissional que já se candidatou recebe a candidatura', async () => {
    prisma.job.findFirst.mockResolvedValue(
      jobRow({ candidaturas: [application] }),
    );

    const result = await useCase.execute('job-1', PROF);

    expect(result.hasApplied).toBe(true);
    expect(result.application).toEqual(application);
  });

  it.each([JobStatus.PAUSADA, JobStatus.ENCERRADA])(
    'vaga %s abre para quem se candidatou',
    async (status) => {
      prisma.job.findFirst.mockResolvedValue(
        jobRow({ status, candidaturas: [application] }),
      );

      const result = await useCase.execute('job-1', PROF);

      expect(result.status).toBe(status);
    },
  );

  it.each([JobStatus.PAUSADA, JobStatus.ENCERRADA])(
    'vaga %s dá 404 para quem não se candidatou',
    async (status) => {
      prisma.job.findFirst.mockResolvedValue(jobRow({ status }));

      await expect(useCase.execute('job-1', PROF)).rejects.toThrow(
        new NotFoundException('Vaga não encontrada'),
      );
    },
  );

  it('404 quando a vaga não existe, está inativa, excluída ou o dono foi excluído', async () => {
    prisma.job.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('job-x', PROF)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([JobStatus.ABERTA, JobStatus.PAUSADA, JobStatus.ENCERRADA])(
    'restaurante dono vê a própria vaga %s, sem candidatura',
    async (status) => {
      prisma.job.findFirst.mockResolvedValue(jobRow({ status }));

      const result = await useCase.execute('job-1', OWNER);

      expect(result.status).toBe(status);
      expect(result.hasApplied).toBe(false);
      expect(result.application).toBeNull();
    },
  );

  it('restaurante não vê vaga de outro restaurante (404, sem vazar)', async () => {
    prisma.job.findFirst.mockResolvedValue(jobRow());

    await expect(
      useCase.execute('job-1', OTHER_RESTAURANT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
