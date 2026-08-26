import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import { UpdateMyProfileUseCase } from './update-my-profile.use-case';

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
    prisma.professional.update.mockResolvedValue({
      userId: 'professional-1',
      fullName: 'Maria Santos',
      profilePhoto: null,
      mainRole: 'Cozinheira',
      interestedRoles: ['Chefe de Cozinha'],
      experienceSummary: '8 anos de experiência',
      neighborhood: 'Centro',
      zipCode: '01001-000',
    });

    const result = await useCase.execute({
      user: { id: 'professional-1', role: Role.PROFISSIONAL },
      payload: {
        fullName: 'Maria Santos',
        experienceSummary: '8 anos de experiência',
      },
    });

    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { userId: 'professional-1' },
      data: {
        fullName: 'Maria Santos',
        experienceSummary: '8 anos de experiência',
      },
    });
    expect(result.role).toBe(Role.PROFISSIONAL);
    expect(result.userId).toBe('professional-1');
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