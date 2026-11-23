import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ProfilePhotoStorage,
  detectImageExtension,
} from '../profile-photo/profile-photo.storage';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
}

export interface PhotoResponse {
  // Profissional: profilePhoto. Restaurante: logoUrl. null = sem foto.
  url: string | null;
}

@Injectable()
export class UpdateMyPhotoUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ProfilePhotoStorage,
  ) {}

  async upload(
    user: JwtPayload,
    file: UploadedPhoto | undefined,
  ): Promise<PhotoResponse> {
    if (!file || file.size === 0) {
      throw new BadRequestException('Envie a imagem no campo "file"');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException('A imagem deve ter no máximo 5 MB');
    }
    const extension = detectImageExtension(file.buffer);
    if (!extension) {
      throw new BadRequestException('Formato inválido. Use JPG, PNG ou WEBP');
    }

    const previous = await this.currentPhoto(user);
    const url = await this.storage.save(file.buffer, extension);
    try {
      await this.setPhoto(user, url);
    } catch (error) {
      // Banco falhou: não deixa o arquivo novo órfão.
      await this.storage.removeIfOwned(url);
      throw error;
    }
    await this.storage.removeIfOwned(previous);
    return { url };
  }

  async remove(user: JwtPayload): Promise<void> {
    const previous = await this.currentPhoto(user);
    await this.setPhoto(user, null);
    await this.storage.removeIfOwned(previous);
  }

  private async currentPhoto(user: JwtPayload): Promise<string | null> {
    if (user.role === Role.PROFISSIONAL) {
      const professional = await this.prisma.professional.findUnique({
        where: { userId: user.id },
        select: { profilePhoto: true, deletedAt: true },
      });
      if (!professional || professional.deletedAt) {
        throw new NotFoundException('Profissional não encontrado');
      }
      return professional.profilePhoto;
    }
    if (user.role === Role.RESTAURANTE) {
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { userId: user.id },
        select: { logoUrl: true, deletedAt: true },
      });
      if (!restaurant || restaurant.deletedAt) {
        throw new NotFoundException('Restaurante não encontrado');
      }
      return restaurant.logoUrl;
    }
    throw new ForbiddenException('Role sem foto de perfil');
  }

  private async setPhoto(user: JwtPayload, url: string | null): Promise<void> {
    if (user.role === Role.PROFISSIONAL) {
      await this.prisma.professional.update({
        where: { userId: user.id },
        data: { profilePhoto: url },
      });
      return;
    }
    await this.prisma.restaurant.update({
      where: { userId: user.id },
      data: { logoUrl: url },
    });
  }
}
