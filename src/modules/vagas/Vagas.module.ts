import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { VagasController } from './vagas.controller';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';

@Module({
  imports: [AuthModule],
  controllers: [VagasController],
  providers: [CreateVagaUseCase],
})
export class VagasModule {}
