import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractType, Prisma } from '@prisma/client';
import { VagaResponseDto } from '../dto/vaga-response.dto';

interface CreateVagaInput {
  titulo: string;
  descricao: string;
  requisitos?: string;
  salario?: number;
  tipoContrato: ContractType;
  restauranteId: string;
}

@Injectable()
export class CreateVagaUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: CreateVagaInput): Promise<VagaResponseDto> {
    // Camada 1: barra o restaurante inexistente antes de qualquer escrita.
    // Dá a mensagem clara e barata no caso normal (a maioria das requisições).
    const restaurante = await this.prisma.restaurant.findUnique({
      where: { userId: input.restauranteId },
      select: { userId: true, active: true, deletedAt: true },
    });

    // O token vive 7 dias, então ele sobrevive à desativação/exclusão lógica do
    // restaurante: um token ainda válido não pode publicar vaga em nome de um
    // restaurante inativo ou removido.
    if (!restaurante || !restaurante.active || restaurante.deletedAt) {
      throw new NotFoundException('Restaurante não encontrado');
    }

    try {
      const vaga = await this.prisma.job.create({
        data: {
          title: input.titulo,
          description: input.descricao,
          requirements: input.requisitos,
          salary: input.salario,
          contractType: input.tipoContrato,
          restaurantId: input.restauranteId,
        },
      });

      // Monta a resposta só com campos públicos — updatedAt/deletedAt/active
      // do modelo Prisma não vazam para o consumidor da API.
      return {
        id: vaga.id,
        titulo: vaga.title,
        descricao: vaga.description,
        requisitos: vaga.requirements ?? undefined,
        salario: vaga.salary?.toNumber(),
        tipoContrato: vaga.contractType,
        status: vaga.status,
        restauranteId: vaga.restaurantId,
        createdAt: vaga.createdAt,
      };
    } catch (error) {
      // Camada 2: rede de segurança contra corrida — o restaurante pode ter
      // sido removido entre a checagem acima e o create (violação de FK, P2003).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new NotFoundException('Restaurante não encontrado');
      }
      throw error;
    }
  }
}
