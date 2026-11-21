import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Mobility, Role, WorkModel } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { EXPERIENCES_INCLUDE } from '../professional-profile.mapper';
import { UpdateMyProfileUseCase } from './update-my-profile.use-case';

const professionalRow = (overrides: Record<string, unknown> = {}) => ({
  userId: 'professional-1',
  fullName: 'Maria Santos',
  profilePhoto: null,
  mainRole: 'Cozinheira',
  interestedRoles: ['Chefe de Cozinha'],
  experienceSummary: '8 anos de experiência',
  neighborhood: 'Centro',
  zipCode: '01001-000',
  specialties: [],
  city: null,
  state: null,
  workModels: [],
  mobility: null,
  experiences: [],
  ...overrides,
});

const createMockPrisma = () => ({
  professional: {
    update: jest.fn(),
  },
  restaurant: {
    update: jest.fn(),
  },
});

type MockPrisma = ReturnType<typeof createMockPrisma>;

describe('UpdateMyProfileUseCase', () => {
  let useCase: UpdateMyProfileUseCase;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    useCase = new UpdateMyProfileUseCase(prisma as unknown as PrismaService);
  });

  it('atualiza perfil de profissional usando o id e role do token', async () => {
    prisma.professional.update.mockResolvedValue(professionalRow());

    const result = await useCase.execute({
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
      payload: {
        fullName: 'Maria Santos',
        experienceSummary: '8 anos de experiência',
      },
    });

    // Sem "experiences" no body, a lista existente não é tocada.
    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { userId: 'professional-1' },
      data: {
        fullName: 'Maria Santos',
        experienceSummary: '8 anos de experiência',
      },
      include: EXPERIENCES_INCLUDE,
    });
    expect(result.role).toBe(Role.PROFISSIONAL);
    expect(result.userId).toBe('professional-1');
  });

  it('aceita os campos novos do perfil e substitui as experiências', async () => {
    prisma.professional.update.mockResolvedValue(
      professionalRow({
        specialties: ['Confeitaria'],
        city: 'São Paulo',
        state: 'SP',
        workModels: [WorkModel.CLT, WorkModel.FREELANCER],
        mobility: Mobility.NACIONAL,
        experiences: [
          {
            id: 'exp-1',
            company: 'Restaurante Origem',
            role: 'Chef',
            startDate: new Date('2019-01-01T00:00:00Z'),
            endDate: null,
            description: null,
          },
        ],
      }),
    );

    const result = await useCase.execute({
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
      payload: {
        specialties: ['Confeitaria'],
        city: 'São Paulo',
        state: 'sp',
        workModels: ['CLT', 'FREELANCER'],
        mobility: 'NACIONAL',
        experiences: [
          {
            company: 'Restaurante Origem',
            role: 'Chef',
            startDate: '2019-01-01',
            endDate: null,
          },
        ],
      },
    });

    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { userId: 'professional-1' },
      data: {
        specialties: ['Confeitaria'],
        city: 'São Paulo',
        state: 'SP',
        workModels: ['CLT', 'FREELANCER'],
        mobility: 'NACIONAL',
        experiences: {
          deleteMany: {},
          create: [
            {
              company: 'Restaurante Origem',
              role: 'Chef',
              startDate: new Date('2019-01-01T00:00:00Z'),
              endDate: null,
              description: null,
            },
          ],
        },
      },
      include: EXPERIENCES_INCLUDE,
    });
    expect(result.profile).toMatchObject({
      state: 'SP',
      availability: { workModels: ['CLT', 'FREELANCER'], mobility: 'NACIONAL' },
      experiences: [{ id: 'exp-1', startDate: '2019-01-01', endDate: null }],
    });
  });

  it('lista vazia de experiências apaga todas', async () => {
    prisma.professional.update.mockResolvedValue(professionalRow());

    await useCase.execute({
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
      payload: { experiences: [] },
    });

    expect(prisma.professional.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { experiences: { deleteMany: {}, create: [] } },
      }),
    );
  });

  it('aceita trocar o CEP por outro válido', async () => {
    prisma.professional.update.mockResolvedValue(
      professionalRow({ zipCode: '20040-000' }),
    );

    const result = await useCase.execute({
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
      payload: { zipCode: '20040-000' },
    });

    expect(result.profile).toMatchObject({ zipCode: '20040-000' });
  });

  it.each([null, ''])(
    'restaurante pode apagar o CEP (itinerante): %p vira null',
    async (zipCode) => {
      prisma.restaurant.update.mockResolvedValue({
        userId: 'restaurant-1',
        zipCode: null,
      });

      await useCase.execute({
        user: { id: 'restaurant-1', role: Role.RESTAURANTE },
        payload: { zipCode },
      });

      expect(prisma.restaurant.update).toHaveBeenCalledWith({
        where: { userId: 'restaurant-1' },
        data: { zipCode: null },
      });
    },
  );

  it.each([
    [Role.PROFISSIONAL, null],
    [Role.PROFISSIONAL, ''],
    [Role.PROFISSIONAL, '0100-000'],
    [Role.RESTAURANTE, 'abc'],
    [Role.RESTAURANTE, '0100-000'],
  ])('%s não pode gravar CEP inválido (%p)', async (role, zipCode) => {
    await expect(
      useCase.execute({
        user: { id: 'user-1', role },
        payload: { zipCode },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.update).not.toHaveBeenCalled();
    expect(prisma.restaurant.update).not.toHaveBeenCalled();
  });

  it.each([
    ['UF inválida', { state: 'São Paulo' }],
    ['modelo de trabalho desconhecido', { workModels: ['ESTAGIO'] }],
    ['modelo de trabalho repetido', { workModels: ['CLT', 'CLT'] }],
    ['mobilidade desconhecida', { mobility: 'MUNDIAL' }],
    [
      'data com hora',
      {
        experiences: [
          { company: 'A', role: 'B', startDate: '2019-01-01T10:00:00Z' },
        ],
      },
    ],
    [
      'data impossível',
      { experiences: [{ company: 'A', role: 'B', startDate: '2019-02-30' }] },
    ],
    [
      'campo extra na experiência',
      {
        experiences: [
          { company: 'A', role: 'B', startDate: '2019-01-01', salary: 1 },
        ],
      },
    ],
    [
      'fim antes do início',
      {
        experiences: [
          {
            company: 'A',
            role: 'B',
            startDate: '2020-01-01',
            endDate: '2019-01-01',
          },
        ],
      },
    ],
  ])('rejeita com 400: %s', async (_case, payload) => {
    await expect(
      useCase.execute({
        user: { id: 'professional-1', role: Role.PROFISSIONAL },
        payload,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.update).not.toHaveBeenCalled();
  });

  // null em coluna NOT NULL chegava ao Prisma e virava 500.
  it.each([
    [Role.PROFISSIONAL, 'fullName'],
    [Role.PROFISSIONAL, 'mainRole'],
    [Role.PROFISSIONAL, 'interestedRoles'],
    [Role.PROFISSIONAL, 'specialties'],
    [Role.PROFISSIONAL, 'workModels'],
    [Role.PROFISSIONAL, 'experiences'],
    [Role.RESTAURANTE, 'restaurantName'],
    [Role.RESTAURANTE, 'cuisineType'],
    [Role.RESTAURANTE, 'description'],
    [Role.RESTAURANTE, 'address'],
    [Role.RESTAURANTE, 'phone'],
  ])('%s: %s = null é 400, não 500', async (role, field) => {
    await expect(
      useCase.execute({
        user: { id: 'user-1', role },
        payload: { [field]: null },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.update).not.toHaveBeenCalled();
    expect(prisma.restaurant.update).not.toHaveBeenCalled();
  });

  it.each([
    [Role.PROFISSIONAL, 'neighborhood'],
    [Role.PROFISSIONAL, 'experienceSummary'],
    [Role.PROFISSIONAL, 'profilePhoto'],
    [Role.PROFISSIONAL, 'city'],
    [Role.PROFISSIONAL, 'mobility'],
    [Role.RESTAURANTE, 'logoUrl'],
  ])('%s: %s = null continua apagando o campo', async (role, field) => {
    prisma.professional.update.mockResolvedValue(professionalRow());
    prisma.restaurant.update.mockResolvedValue({ userId: 'user-1' });

    await useCase.execute({
      user: { id: 'user-1', role },
      payload: { [field]: null },
    });

    const update =
      role === Role.PROFISSIONAL
        ? prisma.professional.update
        : prisma.restaurant.update;
    const [[args]] = update.mock.calls as [[{ data: Record<string, unknown> }]];
    expect(args.data[field]).toBeNull();
  });

  it('atualiza perfil de restaurante usando o id e role do token', async () => {
    prisma.restaurant.update.mockResolvedValue({
      userId: 'restaurant-1',
      restaurantName: 'Bistrô Paulista',
      cuisineType: 'Brasileira',
      description: 'Comida caseira com opções regionais',
      address: 'Rua A, 123',
      phone: '+55 11 99999-9999',
      zipCode: '01310-100',
      logoUrl: null,
    });

    const result = await useCase.execute({
      user: { id: 'restaurant-1', role: Role.RESTAURANTE },
      payload: {
        description: 'Comida caseira com opções regionais',
        address: 'Rua A, 123',
      },
    });

    expect(prisma.restaurant.update).toHaveBeenCalledWith({
      where: { userId: 'restaurant-1' },
      data: {
        description: 'Comida caseira com opções regionais',
        address: 'Rua A, 123',
      },
    });
    expect(result.role).toBe(Role.RESTAURANTE);
    expect(result.userId).toBe('restaurant-1');
  });

  it('bloqueia campo sensível fora do DTO permitido', async () => {
    await expect(
      useCase.execute({
        user: { id: 'professional-1', role: Role.PROFISSIONAL },
        payload: {
          email: 'nao-pode@atualizar.com',
        },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.professional.update).not.toHaveBeenCalled();
    expect(prisma.restaurant.update).not.toHaveBeenCalled();
  });

  it('retorna 404 quando perfil da role não existe', async () => {
    prisma.restaurant.update.mockRejectedValue({ code: 'P2025' });

    await expect(
      useCase.execute({
        user: { id: 'restaurant-missing', role: Role.RESTAURANTE },
        payload: { address: 'Rua B, 999' },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
