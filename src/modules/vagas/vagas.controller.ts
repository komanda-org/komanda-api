import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateCandidaturaDto } from './dto/create-candidatura.dto';
import { CandidaturaResponseDto } from './dto/candidatura-response.dto';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';
import { CandidatarVagaUseCase } from './use-cases/candidatar-vaga.use-case';

// Os guards ficam no nível da classe: valem para todas as rotas abaixo.
// Cada método declara só o papel que pode acessá-lo, via @Roles.
@Controller('vagas')
@UseGuards(AuthGuard, RolesGuard)
export class VagasController {
  constructor(
    private readonly createVaga: CreateVagaUseCase,
    private readonly candidatarVaga: CandidatarVagaUseCase,
  ) {}

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

  @Post(':id/candidaturas')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.PROFISSIONAL)
  async candidatar(
    @Param('id') vagaId: string,
    @Body() _dto: CreateCandidaturaDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CandidaturaResponseDto> {
    // Mesma regra do create: o profissional vem do token, não do body.
    const candidatura = await this.candidatarVaga.execute(vagaId, req.user.id);

    return new CandidaturaResponseDto({
      id: candidatura.id,
      vagaId: candidatura.jobId,
      profissionalId: candidatura.professionalId,
      createdAt: candidatura.createdAt,
    });
  }
}
