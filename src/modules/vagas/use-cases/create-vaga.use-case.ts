import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractType } from '@prisma/client';
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
        // Barra o restaurante inexistente antes de qualquer escrita.
        // Sem isso, um restauranteId inválido causaria erro de FK ou vaga órfã.
        const restaurante = await this.prisma.restaurant.findUnique({
            where: { userId: input.restauranteId },
        });

        if (!restaurante) {
            throw new NotFoundException('Restaurante não encontrado');
        }

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

        // Monta a resposta só com campos públicos — createdAt/updatedAt/
        // deletedAt/active do modelo Prisma não vazam para o consumidor da API.
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
    }
}
