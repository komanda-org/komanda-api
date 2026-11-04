import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DenunciasController } from './Denuncias.controller';
import { CreateDenunciaUseCase } from './use-cases/create-denuncia.use-case';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DenunciasController],
  providers: [CreateDenunciaUseCase],
})
export class DenunciasModule {}
