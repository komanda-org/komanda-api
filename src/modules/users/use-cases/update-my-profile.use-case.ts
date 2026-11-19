import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  UpdateProfessionalProfileDto,
  UpdateRestaurantProfileDto,
} from '../update-user.dto';
import {
  EXPERIENCES_INCLUDE,
  toExperienceCreateInput,
  toMyProfileResponse,
} from '../professional-profile.mapper';

interface UpdateMyProfileInput {
  user: JwtPayload;
  payload: unknown;
}

export interface UpdatedProfileResponse {
  userId: string;
  role: Role;
  profile: Record<string, unknown>;
}

@Injectable()
export class UpdateMyProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: UpdateMyProfileInput): Promise<UpdatedProfileResponse> {
    if (input.user.role === Role.PROFISSIONAL) {
      const { experiences, ...fields } = await this.validatePayload(
        UpdateProfessionalProfileDto,
        input.payload,
      );

      for (const experience of experiences ?? []) {
        if (experience.endDate && experience.endDate < experience.startDate) {
          throw new BadRequestException(
            `Experiência em ${experience.company}: endDate não pode ser anterior a startDate`,
          );
        }
      }

      try {
        const professional = await this.prisma.professional.update({
          where: { userId: input.user.id },
          data: {
            ...fields,
            // Lista enviada = estado final. Apagar e recriar dentro do mesmo
            // update é atômico: ou troca tudo, ou nada muda.
            ...(experiences !== undefined && {
              experiences: {
                deleteMany: {},
                create: experiences.map(toExperienceCreateInput),
              },
            }),
          },
          include: EXPERIENCES_INCLUDE,
        });

        return {
          userId: professional.userId,
          role: Role.PROFISSIONAL,
          profile: {
            ...toMyProfileResponse(professional),
            interestedRoles: professional.interestedRoles,
            zipCode: professional.zipCode,
          },
        };
      } catch (error: any) {
        this.throwIfProfileNotFound(error, 'Profissional não encontrado');
        throw error;
      }
    }

    if (input.user.role === Role.RESTAURANTE) {
      const data = await this.validatePayload(
        UpdateRestaurantProfileDto,
        input.payload,
      );

      try {
        const restaurant = await this.prisma.restaurant.update({
          where: { userId: input.user.id },
          data,
        });

        return {
          userId: restaurant.userId,
          role: Role.RESTAURANTE,
          profile: {
            restaurantName: restaurant.restaurantName,
            cuisineType: restaurant.cuisineType,
            description: restaurant.description,
            address: restaurant.address,
            phone: restaurant.phone,
            zipCode: restaurant.zipCode,
            logoUrl: restaurant.logoUrl,
          },
        };
      } catch (error: any) {
        this.throwIfProfileNotFound(error, 'Restaurante não encontrado');
        throw error;
      }
    }

    throw new ForbiddenException(
      'Role não permitida para atualização de perfil',
    );
  }

  private async validatePayload<T extends object>(
    DtoClass: new () => T,
    payload: unknown,
  ): Promise<T> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Body inválido para atualização de perfil');
    }

    const dto = plainToInstance(DtoClass, payload);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return dto;
  }

  private throwIfProfileNotFound(error: any, message: string): void {
    if (error?.code === 'P2025') {
      throw new NotFoundException(message);
    }
  }
}
