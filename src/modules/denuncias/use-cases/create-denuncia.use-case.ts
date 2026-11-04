import { Injectable, NotFoundException } from '@nestjs/common';
import { DenunciaTargetType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

interface CreateDenunciaInput {
  authorId: string;
  targetType: DenunciaTargetType;
  targetId: string;
  reason: string;
}

@Injectable()
export class CreateDenunciaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateDenunciaInput) {
    await this.assertTargetExists(input.targetType, input.targetId);

    return this.prisma.denuncia.create({
      data: {
        authorId: input.authorId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        // status fica no default PENDENTE do schema — não repetir aqui.
      },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });
  }

  private async assertTargetExists(
    targetType: DenunciaTargetType,
    targetId: string,
  ): Promise<void> {
    if (targetType === DenunciaTargetType.PERFIL) {
      const perfil = await this.prisma.user.findFirst({
        where: { id: targetId, active: true, deletedAt: null },
        select: { id: true },
      });
      if (!perfil) {
        throw new NotFoundException('Perfil denunciado não encontrado');
      }
      return;
    }

    if (targetType === DenunciaTargetType.VAGA) {
      const vaga = await this.prisma.job.findFirst({
        where: { id: targetId, active: true, deletedAt: null },
        select: { id: true },
      });
      if (!vaga) {
        throw new NotFoundException('Vaga denunciada não encontrada');
      }
      return;
    }

    // MENSAGEM: o schema ainda não tem tabela de chat — não há o que
    // validar. Ceiling documentado em `Denuncia.targetId`.
  }
}
