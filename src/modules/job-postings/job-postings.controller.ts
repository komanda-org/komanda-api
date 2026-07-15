import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { ListJobApplicantsResponseDto } from './dto/job-applicant-response.dto';
import { JobPostingResponseDto } from './dto/job-posting-response.dto';
import { ListJobApplicantsQueryDto } from './dto/list-job-applicants-query.dto';
import { ApplyToJobPostingUseCase } from './use-cases/apply-to-job-posting.use-case';
import { CreateJobPostingUseCase } from './use-cases/create-job-posting.use-case';
import { ListJobApplicantsUseCase } from './use-cases/list-job-applicants.use-case';

// Os guards ficam no nível da classe: valem para todas as rotas abaixo.
// Cada método declara só o papel que pode acessá-lo, via @Roles.
@Controller('job-postings')
@UseGuards(AuthGuard, RolesGuard)
export class JobPostingsController {
  constructor(
    private readonly createJobPosting: CreateJobPostingUseCase,
    private readonly applyToJobPosting: ApplyToJobPostingUseCase,
    private readonly listJobApplicants: ListJobApplicantsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.RESTAURANTE)
  async create(
    @Body() dto: CreateJobPostingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<JobPostingResponseDto> {
    // restauranteId vem do token, nunca do body (regra técnica da task).
    return this.createJobPosting.execute({
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
  async apply(
    @Param('id') vagaId: string,
    @Body() _dto: CreateApplicationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationResponseDto> {
    // Mesma regra do create: o profissional vem do token, não do body.
    const candidatura = await this.applyToJobPosting.execute(
      vagaId,
      req.user.id,
    );

    return new ApplicationResponseDto({
      id: candidatura.id,
      vagaId: candidatura.jobId,
      profissionalId: candidatura.professionalId,
      createdAt: candidatura.createdAt,
    });
  }

  @Get(':id/candidaturas')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  async listApplicants(
    @Param('id') vagaId: string,
    @Query() query: ListJobApplicantsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ListJobApplicantsResponseDto> {
    // A dona da vaga é conferida no use case contra o id do token — a rota
    // não recebe restauranteId de fora.
    return this.listJobApplicants.execute({
      vagaId,
      restauranteId: req.user.id,
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
  }
}
