import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

// Guarda compartilhada por edição e troca de status: vaga inexistente ou
// excluída logicamente é 404; vaga de outro restaurante é 403.
export async function findOwnedJob(
  prisma: PrismaService,
  jobId: string,
  restaurantId: string,
): Promise<{ status: JobStatus }> {
  const vaga = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      restaurantId: true,
      status: true,
      active: true,
      deletedAt: true,
    },
  });

  if (!vaga || !vaga.active || vaga.deletedAt) {
    throw new NotFoundException('Vaga não encontrada');
  }

  if (vaga.restaurantId !== restaurantId) {
    throw new ForbiddenException(
      'Você não tem permissão para alterar esta vaga',
    );
  }

  return vaga;
}

// P2025 = nenhuma linha casou no update (a vaga mudou de status no meio do
// caminho): para o cliente é conflito de concorrência, não erro de servidor.
export function rethrowJobConflict(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new ConflictException(message);
  }
  throw error;
}
