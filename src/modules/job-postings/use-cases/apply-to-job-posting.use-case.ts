import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, JobStatus, Candidatura } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ApplyToJobPostingUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(vagaId: string, profissionalId: string): Promise<Candidatura> {
    // 1. Verify vaga exists and is open.
    // Nada de `vaga` entra na resposta — o DTO é montado a partir da candidatura
    // criada —, então só trazemos os três campos que as guardas abaixo usam.
    const vaga = await this.prisma.job.findUnique({
      where: { id: vagaId },
      select: { status: true, active: true, deletedAt: true },
    });

    // Vaga excluída logicamente é indistinguível de inexistente para o profissional.
    // Precisa vir antes das checagens de estado: um 422 confirmaria que ela existe.
    if (!vaga || vaga.deletedAt) {
      throw new NotFoundException('Vaga não encontrada');
    }

    // `active` é a desativação do registro (par com deletedAt); `status` abaixo é
    // estado de negócio. Eixos distintos, por isso guardas e mensagens separadas.
    if (!vaga.active) {
      throw new UnprocessableEntityException(
        'A vaga não está disponível para candidaturas',
      );
    }

    if (vaga.status !== JobStatus.ABERTA) {
      throw new UnprocessableEntityException(
        'A vaga não está aberta para candidaturas',
      );
    }

    // 2. Attempt to create candidacy
    try {
      const candidatura = await this.prisma.candidatura.create({
        data: {
          jobId: vagaId,
          // O campo no schema é `professionalId` (inglês). O parâmetro chega em
          // português, daí o mapeamento explícito — antes gravava `profissionalId`,
          // que não existe no model.
          professionalId: profissionalId,
        },
        include: {
          job: true,
          professional: {
            include: {
              user: true,
            },
          },
        },
      });

      // Return a DTO-like object (we'll let controller map)
      return candidatura;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Unique constraint failure on jobId + profissionalId
        throw new ConflictException('Você já se candidatou a esta vaga');
      }
      throw error;
    }
  }
}
