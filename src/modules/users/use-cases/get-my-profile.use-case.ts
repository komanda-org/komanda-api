import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import type {
  MeResponseDto,
  MyProfessionalMeResponseDto,
  MyRestaurantMeResponseDto,
} from '../dto/my-restaurant-profile-response.dto';
import {
  EXPERIENCES_INCLUDE,
  toMyProfileResponse,
} from '../professional-profile.mapper';

@Injectable()
export class GetMyProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  // id e role vêm sempre do token. A exclusão de conta é soft-delete no User
  // (DeleteAccountUseCase), então os filtros também olham o usuário dono.
  async execute(user: JwtPayload): Promise<MeResponseDto> {
    return user.role === Role.RESTAURANTE
      ? this.restaurantProfile(user.id)
      : this.professionalProfile(user.id);
  }

  private async professionalProfile(
    userId: string,
  ): Promise<MyProfessionalMeResponseDto> {
    const professional = await this.prisma.professional.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      include: EXPERIENCES_INCLUDE,
    });

    if (!professional) {
      throw new NotFoundException('Perfil de profissional não encontrado');
    }

    // O mapper monta a resposta campo a campo: nada da entidade crua vaza.
    return { role: Role.PROFISSIONAL, ...toMyProfileResponse(professional) };
  }

  private async restaurantProfile(
    userId: string,
  ): Promise<MyRestaurantMeResponseDto> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      include: { user: { select: { email: true } } },
    });

    if (!restaurant) {
      throw new NotFoundException('Perfil de restaurante não encontrado');
    }

    return {
      role: Role.RESTAURANTE,
      id: restaurant.userId,
      email: restaurant.user.email,
      restaurantName: restaurant.restaurantName,
      cnpj: restaurant.cnpj,
      cuisineType: restaurant.cuisineType,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      zipCode: restaurant.zipCode,
      logoUrl: restaurant.logoUrl,
      averageRating: restaurant.averageRating,
      plan: restaurant.plan,
    };
  }
}
