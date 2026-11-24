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
import { ZipCodeGeocoder } from 'src/common/geocoding/zip-code-geocoder';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoder: ZipCodeGeocoder,
  ) {}

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

      const coordinates = await this.recomputeRestaurantCoordinates(
        input.user.id,
        data,
      );

      try {
        const restaurant = await this.prisma.restaurant.update({
          where: { userId: input.user.id },
          data: { ...data, ...coordinates },
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

  // CEP ou endereço mudou: geocodifica de novo. Devolve as colunas a gravar,
  // ou {} quando nada de localização mudou (coordenadas atuais ficam).
  // Falha na API externa vira null: coordenada antiga apontaria para o lugar
  // errado, e o restaurante só sai da busca com raio até a próxima edição.
  private async recomputeRestaurantCoordinates(
    userId: string,
    data: UpdateRestaurantProfileDto,
  ): Promise<{ latitude?: number | null; longitude?: number | null }> {
    if (data.zipCode === undefined && data.address === undefined) return {};

    const current = await this.prisma.restaurant.findUnique({
      where: { userId },
      select: { zipCode: true, address: true },
    });
    // Sem perfil: o update logo abaixo responde 404.
    if (!current) return {};

    const zipCode = data.zipCode === undefined ? current.zipCode : data.zipCode;
    const address = data.address ?? current.address;
    const sameZip =
      (zipCode?.replace(/\D/g, '') ?? null) ===
      (current.zipCode?.replace(/\D/g, '') ?? null);
    if (sameZip && address === current.address) return {};

    const coordinates = await this.geocoder.geocode({ zipCode, address });
    return {
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    };
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
