import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
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
import type { JwtPayload } from 'src/auth/interfaces/authenticated-request.interface';
import { ReqUser } from 'src/modules/users/req-user.decorator';
import { JobDetailResponseDto } from './dto/job-detail-response.dto';
import { GetJobByIdUseCase } from './use-cases/get-job-by-id.use-case';
import { SkipThrottle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { SearchJobsQueryDto } from './dto/search-jobs-query.dto';
import { SearchJobsUseCase } from './use-cases/search-jobs.use-case';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(AuthGuard, RolesGuard)
// Só leituras autenticadas de tela (lista e busca); ver notifications.controller
@SkipThrottle()
export class JobsController {
  constructor(
    private readonly searchJobsUseCase: SearchJobsUseCase,
    private readonly getJobByIdUseCase: GetJobByIdUseCase,
  ) {}

  @Get()
  @Roles(Role.PROFISSIONAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar vagas disponíveis' })
  @ApiResponse({ status: 200, description: 'Lista de vagas' })
  async listJobs(@Query() query: ListJobsQueryDto) {
    return await this.searchJobsUseCase.execute({
      shift: query.shift,
      skip: query.skip,
      take: query.take,
    });
  }

  @Get('search')
  @Roles(Role.PROFISSIONAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pesquisar vagas por termo, tipo de contrato, turno e salário mínimo',
  })
  @ApiResponse({ status: 200, description: 'Lista filtrada de vagas' })
  async searchJobs(@Query() query: SearchJobsQueryDto) {
    return await this.searchJobsUseCase.execute(query);
  }

  // Depois de 'search': senão "search" seria lido como :id.
  @Get(':id')
  @Roles(Role.PROFISSIONAL, Role.RESTAURANTE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detalhe da vaga',
    description:
      'Profissional: vaga ABERTA, ou pausada/encerrada em que já se candidatou. Restaurante: só as próprias vagas, em qualquer status.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: JobDetailResponseDto })
  @ApiResponse({ status: 400, description: 'id não é um UUID' })
  @ApiResponse({ status: 401, description: 'Token ausente ou inválido' })
  @ApiResponse({ status: 403, description: 'Role sem acesso' })
  @ApiResponse({ status: 404, description: 'Vaga não encontrada' })
  async getJob(
    @Param('id', new ParseUUIDPipe()) id: string,
    @ReqUser() user: JwtPayload,
  ): Promise<JobDetailResponseDto> {
    return this.getJobByIdUseCase.execute(id, user);
  }
}
