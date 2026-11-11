import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { SearchProfessionalsQueryDto } from './dto/search-professionals-query.dto';
import { SearchProfessionalsResponseDto } from './dto/professional-search-response.dto';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';
import { SearchProfessionalsUseCase } from './use-cases/search-professionals.use-case';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly registerProfessionalUseCase: RegisterProfessionalUseCase,
    private readonly searchProfessionalsUseCase: SearchProfessionalsUseCase,
  ) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastrar profissional' })
  @ApiResponse({ status: 201, description: 'Profissional criado com sucesso' })
  async create(@Body() dto: CreateProfessionalDto) {
    return await this.registerProfessionalUseCase.execute(dto);
  }

  @Get('search')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.RESTAURANTE)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar profissionais por cargo principal' })
  @ApiResponse({
    status: 200,
    description: 'Lista de profissionais compatíveis',
  })
  async search(
    @Query() query: SearchProfessionalsQueryDto,
  ): Promise<SearchProfessionalsResponseDto> {
    return await this.searchProfessionalsUseCase.execute(query);
  }
}
