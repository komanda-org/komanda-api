import { Module } from '@nestjs/common';
import { ReviewsController } from './Reviews.controller';
import { CreateReviewUseCase } from './use-cases/create-review.use-case';
import { ListReceivedReviewsUseCase } from './use-cases/list-received-reviews.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ReviewsController],
  providers: [ListReceivedReviewsUseCase, CreateReviewUseCase],
})
export class ReviewsModule {}
