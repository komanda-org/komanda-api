import { Controller, Post, Param, Body, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { CandidatarVagaUseCase } from './use-cases/candidatar-vaga.use-case';
import { CreateCandidaturaDto } from './dto/create-candidatura.dto';
import { CandidaturaResponseDto } from './dto/candidatura-response.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { Role } from '@prisma/client';
import { Request } from 'express';

@Controller('vagas')
export class VagasController {
  constructor(private readonly candidatarVagaUseCase: CandidatarVagaUseCase) {}

  @Post(':id/candidaturas')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.PROFISSIONAL)
  @HttpCode(HttpStatus.CREATED)
  async candidatar(
    @Param('id') vagaId: string,
    @Body() dto: CreateCandidaturaDto,
    @Req() req: Request & { user: { id: string; role: Role } },
  ) {
    const profissionalId = req.user.id;
    const candidatura = await this.candidatarVagaUseCase.execute(vagaId, profissionalId);

    return new CandidaturaResponseDto({
      id: candidatura.id,
      vagaId: candidatura.jobId,
      profissionalId: (candidatura as any).profissionalId,
      createdAt: candidatura.createdAt,
    });
  }
}