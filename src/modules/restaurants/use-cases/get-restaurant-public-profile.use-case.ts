import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RestaurantPublicProfileResponseDto } from '../dto/restaurant-public-profile-response.dto';

export const OPEN_JOBS_LIMIT = 20;

@Injectable()
export class GetRestaurantPublicProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    restaurantId: string,
  ): Promise<RestaurantPublicProfileResponseDto> {
    // Uma consulta só: dados, vagas abertas e contagem de avaliações.
    // A exclusão de conta é soft-delete no User, então o dono também é filtrado.
    const restaurant = await this.prisma.restaurant.findFirst({
      where: {
        userId: restaurantId,
        active: true,
        deletedAt: null,
        user: { deletedAt: null },
      },
      select: {
        userId: true,
        restaurantName: true,
        cuisineType: true,
        description: true,
        address: true,
        phone: true,
        zipCode: true,
        logoUrl: true,
        averageRating: true,
        jobs: {
          where: { status: JobStatus.ABERTA, active: true, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: OPEN_JOBS_LIMIT,
          select: {
            id: true,
            title: true,
            contractType: true,
            salary: true,
            shifts: true,
            urgent: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            avaliacoes: { where: { avaliadorRole: Role.PROFISSIONAL } },
          },
        },
      },
    });

    if (!restaurant) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    return {
      id: restaurant.userId,
      restaurantName: restaurant.restaurantName,
      cuisineType: restaurant.cuisineType,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      zipCode: restaurant.zipCode,
      logoUrl: restaurant.logoUrl,
      averageRating: restaurant.averageRating,
      reviewsCount: restaurant._count.avaliacoes,
      openJobs: restaurant.jobs.map((job) => ({
        id: job.id,
        title: job.title,
        contractType: job.contractType,
        salary: job.salary?.toNumber() ?? null,
        shifts: job.shifts,
        urgent: job.urgent,
        createdAt: job.createdAt,
      })),
    };
  }
}
