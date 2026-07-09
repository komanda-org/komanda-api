import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateVagaDto } from './dto/create-vaga.dto';
import { CreateVagaUseCase } from './use-cases/create-vaga.use-case';

@Controller('vagas')
@UseGuards(AuthGuard, RolesGuard)
export class VagasController {
  constructor(private readonly createVaga: CreateVagaUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.RESTAURANTE)
  async create(@Body() dto: CreateVagaDto, @Req() req: { user: { id: string } }) {
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