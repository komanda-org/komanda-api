import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { VagasController } from './job-postings.controller';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';
import { CandidatarVagaUseCase } from './use-cases/candidatar-vaga.use-case';

// PrismaModule é @Global, então não precisa ser importado aqui.
// AuthModule sim: os guards presos no controller são instanciados no contexto
// deste módulo, e o AuthGuard depende do JwtService.
@Module({
  imports: [AuthModule],
  controllers: [VagasController],
  providers: [CreateVagaUseCase, CandidatarVagaUseCase],
})
export class VagasModule {}
