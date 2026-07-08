import {Injectable} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ContractType } from '@prisma/client';

interface createVagaInput {
    titulo: string;
    descricao: string;
    requisitos?: string;
    salario?: number;
    tipoContrato: ContractType;
    restauranteId: string;
}

@Injectable()
export class CreateVagaUseCase {
    constructor(private readonly prisma: PrismaService){}

    async execute(input: createVagaInput){
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

        return vaga;
    }
}