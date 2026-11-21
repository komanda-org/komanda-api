import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProfessionalPublicProfileResponseDto } from '../dto/professional-public-profile-response.dto';

@Injectable()
export class GetProfessionalPublicProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    professionalId: string,
  ): Promise<ProfessionalPublicProfileResponseDto> {
    // Uma consulta só: dados, experiências e contagem de avaliações.
    // O select é explícito: e-mail, CEP e passwordHash nunca saem do banco.
    const professional = await this.prisma.professional.findFirst({
      where: {
        userId: professionalId,
        active: true,
        deletedAt: null,
        user: { active: true, deletedAt: null },
      },
      select: {
        userId: true,
        fullName: true,
        profilePhoto: true,
        mainRole: true,
        interestedRoles: true,
        specialties: true,
        experienceSummary: true,
        city: true,
        state: true,
        neighborhood: true,
        workModels: true,
        mobility: true,
        averageRating: true,
        createdAt: true,
        experiences: {
          orderBy: { startDate: 'desc' },
          select: {
            id: true,
            company: true,
            role: true,
            startDate: true,
            endDate: true,
            description: true,
          },
        },
        _count: {
          select: {
            avaliacoes: { where: { avaliadorRole: Role.RESTAURANTE } },
          },
        },
      },
    });

    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }

    return {
      id: professional.userId,
      fullName: professional.fullName,
      profilePhoto: professional.profilePhoto,
      mainRole: professional.mainRole,
      interestedRoles: professional.interestedRoles,
      specialties: professional.specialties,
      experienceSummary: professional.experienceSummary,
      city: professional.city,
      state: professional.state,
      neighborhood: professional.neighborhood,
      workModels: professional.workModels,
      mobility: professional.mobility,
      averageRating: professional.averageRating,
      reviewsCount: professional._count.avaliacoes,
      memberSince: professional.createdAt,
      experiences: professional.experiences,
    };
  }
}
