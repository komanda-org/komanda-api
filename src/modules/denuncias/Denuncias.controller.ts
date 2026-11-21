import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { CreateDenunciaUseCase } from './use-cases/create-denuncia.use-case';

@ApiTags('Denuncias')
@ApiBearerAuth()
@Controller('denuncias')
@UseGuards(AuthGuard)
export class DenunciasController {
  constructor(private readonly createDenuncia: CreateDenunciaUseCase) {}

  // Sem @Roles: profissional e restaurante podem denunciar (RF10).
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Denunciar um perfil, uma vaga ou uma mensagem' })
  @ApiResponse({ status: 201, description: 'Denúncia registrada' })
  @ApiResponse({ status: 404, description: 'Alvo da denúncia não encontrado' })
  async create(
    @Body() dto: CreateDenunciaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.createDenuncia.execute({
      authorId: req.user.id,
      targetType: dto.targetType,
      targetId: dto.targetId,
      reason: dto.reason,
    });
  }
}
