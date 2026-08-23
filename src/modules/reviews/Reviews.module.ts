import { Module } from '@nestjs/common';
import { UsersController } from './Users.controller';
import { ListAvaliacoesRecebidasUseCase } from './use-cases/list-avaliacoes-recebidas.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [ListAvaliacoesRecebidasUseCase],
})
export class UsersModule {}
