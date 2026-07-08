import { Module } from '@nestjs/common';
import { CandidatarVagaUseCase } from './use-cases/candidatar-vaga.use-case';
import { VagasController } from './vagas.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VagasController],
  providers: [CandidatarVagaUseCase],
})
export class VagasModule {}
