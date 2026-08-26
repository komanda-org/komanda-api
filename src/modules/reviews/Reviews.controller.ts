import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { ListAvaliacoesQueryDto } from './dto/list-avaliacoes-query.dto';
import { ListAvaliacoesResponseDto } from './dto/avaliacao-response.dto';
import { ListAvaliacoesRecebidasUseCase } from './use-cases/list-avaliacoes-recebidas.use-case';

@Controller('usuarios')
@UseGuards(AuthGuard, RolesGuard)
export class ReviewsController {
  constructor(
    private readonly listAvaliacoesRecebidasUseCase: ListAvaliacoesRecebidasUseCase,
  ) {}

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
