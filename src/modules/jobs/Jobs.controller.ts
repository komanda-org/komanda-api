import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
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
export class JobsController {
  constructor(private readonly searchJobsUseCase: SearchJobsUseCase) {}

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
}
