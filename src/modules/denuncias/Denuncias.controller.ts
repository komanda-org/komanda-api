import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { CreateDenunciaUseCase } from './use-cases/create-denuncia.use-case';

@ApiTags('Denuncias')
@Controller('denuncias')
@UseGuards(AuthGuard)
export class DenunciasController {
  constructor(private readonly createDenuncia: CreateDenunciaUseCase) {}

  // Sem @Roles: profissional e restaurante podem denunciar (RF10).
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
