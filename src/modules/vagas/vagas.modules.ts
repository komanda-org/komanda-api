import { Module } from '@nestjs/common';
import { VagasController } from './vagas.controller';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [VagasController],
  providers: [CreateVagaUseCase, PrismaService],
})
export class VagasModule {}