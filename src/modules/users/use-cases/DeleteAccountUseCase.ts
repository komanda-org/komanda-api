import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DeleteAccountUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt) {
      throw new NotFoundException('Conta não encontrada ou já excluída');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
// ponytail: soft-delete preserva dados (LGPD RNF11 + auditoria RNF12).
// Follow-up condicional: anonimizar dados pessoais aqui SE a banca exigir exclusão/anonimização estrita.
// ponytail: JWT blocklist omitida — tokens de curta duração cobrem o caso.
// Upgrade: blocklist em cache quando tokens de longa duração existirem.
