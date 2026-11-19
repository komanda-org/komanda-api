import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MyProfileResponseDto } from '../dto/my-profile-response.dto';
import {
  EXPERIENCES_INCLUDE,
  toMyProfileResponse,
} from '../professional-profile.mapper';

@Injectable()
export class GetMyProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<MyProfileResponseDto> {
    // O id vem sempre do token. A exclusão de conta é soft-delete no User
    // (DeleteAccountUseCase), então o filtro também olha o usuário dono.
    const professional = await this.prisma.professional.findFirst({
      where: { userId, deletedAt: null, user: { deletedAt: null } },
      include: EXPERIENCES_INCLUDE,
    });

    if (!professional) {
      throw new NotFoundException('Perfil de profissional não encontrado');
    }

    // O mapper monta a resposta campo a campo: nada da entidade crua vaza.
    return toMyProfileResponse(professional);
  }
}
