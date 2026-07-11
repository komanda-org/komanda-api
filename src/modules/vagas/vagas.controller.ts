import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { CreateVagaDto } from './dto/create-vaga.dto';
import { VagaResponseDto } from './dto/vaga-response.dto';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';

@Controller('vagas')
@UseGuards(AuthGuard, RolesGuard)
export class VagasController {
  constructor(private readonly createVaga: CreateVagaUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.RESTAURANTE)
  async create(
    @Body() dto: CreateVagaDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<VagaResponseDto> {
    // restauranteId vem do token, nunca do body (regra técnica da task).
    return this.createVaga.execute({
      titulo: dto.titulo,
      descricao: dto.descricao,
      requisitos: dto.requisitos,
      salario: dto.salario,
      tipoContrato: dto.tipoContrato,
      restauranteId: req.user.id,
    });
  }
}
