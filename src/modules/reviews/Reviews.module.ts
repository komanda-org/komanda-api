import { Module } from '@nestjs/common';
import { ReviewsController } from './Reviews.controller';
import { ListAvaliacoesRecebidasUseCase } from './use-cases/list-avaliacoes-recebidas.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReviewsController],
  providers: [ListAvaliacoesRecebidasUseCase],
})
export class ReviewsModule {}
