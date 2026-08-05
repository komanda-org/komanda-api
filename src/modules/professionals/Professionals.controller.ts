import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly registerProfessionalUseCase: RegisterProfessionalUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastrar profissional' })
  @ApiResponse({ status: 201, description: 'Profissional criado com sucesso' })
  async create(@Body() dto: CreateProfessionalDto) {
    return await this.registerProfessionalUseCase.execute(dto);
  }
}
