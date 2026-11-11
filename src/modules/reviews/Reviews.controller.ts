import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListReviewsQueryDto } from './dto/list-reviews-query.dto';
import { ListReviewsResponseDto } from './dto/review-response.dto';
import { CreateReviewUseCase } from './use-cases/create-review.use-case';
import { ListReceivedReviewsUseCase } from './use-cases/list-received-reviews.use-case';

@ApiTags('Reviews')
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsController {
  constructor(
    private readonly listReceivedReviewsUseCase: ListReceivedReviewsUseCase,
    private readonly createReviewUseCase: CreateReviewUseCase,
  ) {}

  @Post('reviews')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Body() dto: CreateReviewDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createReviewUseCase.execute({
      authorId: req.user.id,
      jobId: dto.jobId,
      receiverId: dto.receiverId,
      rating: dto.rating,
      comment: dto.comment,
    });
  }

  // Sem @Roles: acessível por qualquer usuário autenticado, seja profissional
  // ou restaurante consultando a reputação de outro perfil.
  @Get(':id/reviews')
  @HttpCode(HttpStatus.OK)
  async listReceivedReviews(
    @Param('id') id: string,
    @Query() query: ListReviewsQueryDto,
  ): Promise<ListReviewsResponseDto> {
    return this.listReceivedReviewsUseCase.execute({
      userId: id,
      skip: query.skip,
      take: query.take,
    });
  }
}
