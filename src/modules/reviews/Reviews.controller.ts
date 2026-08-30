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
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateReviewDto } from './dto/create-avaliacao.dto';
import { ListAvaliacoesQueryDto } from './dto/list-avaliacoes-query.dto';
import { ListAvaliacoesResponseDto } from './dto/avaliacao-response.dto';
import { CreateReviewUseCase } from './use-cases/create-avaliacao.use-case';
import { ListAvaliacoesRecebidasUseCase } from './use-cases/list-avaliacoes-recebidas.use-case';

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsController {
  constructor(
    private readonly listReviewsReceivedUseCase: ListAvaliacoesRecebidasUseCase,
    private readonly createReviewUseCase: CreateReviewUseCase,
  ) { }

  @Post('reviews')
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

  @Get('users/:id/reviews')
  @HttpCode(HttpStatus.OK)
  async listReceivedReviews(
    @Param('id') id: string,
    @Query() query: ListAvaliacoesQueryDto,
  ): Promise<ListAvaliacoesResponseDto> {
    return this.listReviewsReceivedUseCase.execute({
      usuarioId: id,
      skip: query.skip,
      take: query.take,
    });
  }
}
