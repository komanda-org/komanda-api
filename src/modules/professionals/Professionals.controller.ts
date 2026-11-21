import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { SearchProfessionalsQueryDto } from './dto/search-professionals-query.dto';
import { SearchProfessionalsResponseDto } from './dto/professional-search-response.dto';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';
import { SearchProfessionalsUseCase } from './use-cases/search-professionals.use-case';
import { ProfessionalPublicProfileResponseDto } from './dto/professional-public-profile-response.dto';
import { GetProfessionalPublicProfileUseCase } from './use-cases/get-professional-public-profile.use-case';

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly registerProfessionalUseCase: RegisterProfessionalUseCase,
    private readonly searchProfessionalsUseCase: SearchProfessionalsUseCase,
    private readonly getProfessionalPublicProfile: GetProfessionalPublicProfileUseCase,
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

  // Depois de 'search': senão ':id' capturaria "search".
  @Get(':id')
  @SkipThrottle() // leitura autenticada de tela; ver notifications.controller
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perfil público do profissional',
    description:
      'Dados, experiências e nota média. Qualquer usuário logado. Não expõe e-mail nem CEP.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'users.id do profissional',
  })
  @ApiOkResponse({ type: ProfessionalPublicProfileResponseDto })
  @ApiResponse({ status: 400, description: 'id não é um UUID' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({ status: 404, description: 'Profissional não encontrado' })
  async getPublicProfile(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProfessionalPublicProfileResponseDto> {
    return this.getProfessionalPublicProfile.execute(id);
  }
}
