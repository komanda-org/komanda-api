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
import { CreateReviewDto } from './dto/create-review.dto';
import { ListAvaliacoesQueryDto } from './dto/list-avaliacoes-query.dto';
import { ListAvaliacoesResponseDto } from './dto/avaliacao-response.dto';
import { CreateReviewUseCase } from './use-cases/create-review.use-case';
import { ListAvaliacoesRecebidasUseCase } from './use-cases/list-avaliacoes-recebidas.use-case';

@Controller('usuarios')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsController {
  constructor(
    private readonly listAvaliacoesRecebidasUseCase: ListAvaliacoesRecebidasUseCase,
    private readonly createReviewUseCase: CreateReviewUseCase,
  ) {}

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

  // Sem @Roles: acessível por qualquer usuário autenticado, seja profissional
  // ou restaurante consultando a reputação de outro perfil.
  @Get(':id/avaliacoes')
  @HttpCode(HttpStatus.OK)
  async listAvaliacoesRecebidas(
    @Param('id') id: string,
    @Query() query: ListAvaliacoesQueryDto,
  ): Promise<ListAvaliacoesResponseDto> {
    return this.listAvaliacoesRecebidasUseCase.execute({
      usuarioId: id,
      skip: query.skip,
      take: query.take,
    });
  }
}
