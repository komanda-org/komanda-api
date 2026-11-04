import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { CreateJobPostingDto } from './dto/create-job-posting.dto';
import { ListJobApplicantsResponseDto } from './dto/job-applicant-response.dto';
import { JobPostingResponseDto } from './dto/job-posting-response.dto';
import { ListJobApplicantsQueryDto } from './dto/list-job-applicants-query.dto';
import { UpdateJobPostingDto } from './dto/update-job-posting.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { ApplyToJobPostingUseCase } from './use-cases/apply-to-job-posting.use-case';
import { CreateJobPostingUseCase } from './use-cases/create-job-posting.use-case';
import { ListJobApplicantsUseCase } from './use-cases/list-job-applicants.use-case';
import { UpdateJobPostingUseCase } from './use-cases/update-job-posting.use-case';
import { UpdateJobStatusUseCase } from './use-cases/update-job-status.use-case';

@ApiTags('Job Postings')
@ApiBearerAuth()
@Controller('jobs')
@UseGuards(AuthGuard, RolesGuard)
export class JobPostingsController {
  constructor(
    private readonly createJobPosting: CreateJobPostingUseCase,
    private readonly applyToJobPosting: ApplyToJobPostingUseCase,
    private readonly listJobApplicants: ListJobApplicantsUseCase,
    private readonly updateJobPosting: UpdateJobPostingUseCase,
    private readonly updateJobStatus: UpdateJobStatusUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({ summary: 'Criar vaga' })
  @ApiResponse({ status: 201, description: 'Vaga criada com sucesso' })
  async create(
    @Body() dto: CreateJobPostingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<JobPostingResponseDto> {
    // restaurantId vem do token, nunca do body (regra técnica da task).
    return this.createJobPosting.execute({
      title: dto.title,
      description: dto.description,
      requirements: dto.requirements,
      salary: dto.salary,
      contractType: dto.contractType,
      shift: dto.shift,
      urgent: dto.urgent,
      restaurantId: req.user.id,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({ summary: 'Editar vaga' })
  @ApiResponse({ status: 200, description: 'Vaga editada com sucesso' })
  @ApiResponse({
    status: 403,
    description: 'A vaga pertence a outro restaurante',
  })
  @ApiResponse({ status: 404, description: 'Vaga não encontrada' })
  @ApiResponse({
    status: 409,
    description: 'A vaga foi alterada por outra requisição',
  })
  @ApiResponse({
    status: 422,
    description: 'Não é possível editar uma vaga encerrada',
  })
  async update(
    @Param('id') jobId: string,
    @Body() dto: UpdateJobPostingDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<JobPostingResponseDto> {
    // Mesma regra do create: o dono vem do token e é conferido no use case.
    return this.updateJobPosting.execute({
      jobId,
      restaurantId: req.user.id,
      changes: {
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements,
        salary: dto.salary,
        contractType: dto.contractType,
        urgent: dto.urgent,
      },
    });
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({ summary: 'Pausar, reabrir ou encerrar vaga' })
  @ApiResponse({ status: 200, description: 'Status da vaga atualizado' })
  @ApiResponse({
    status: 403,
    description: 'A vaga pertence a outro restaurante',
  })
  @ApiResponse({ status: 404, description: 'Vaga não encontrada' })
  @ApiResponse({
    status: 409,
    description: 'O status da vaga foi alterado por outra requisição',
  })
  @ApiResponse({ status: 422, description: 'Transição de status inválida' })
  async updateStatus(
    @Param('id') jobId: string,
    @Body() dto: UpdateJobStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<JobPostingResponseDto> {
    return this.updateJobStatus.execute({
      jobId,
      restaurantId: req.user.id,
      status: dto.status,
    });
  }

  @Post(':id/applications')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.PROFISSIONAL)
  @ApiOperation({ summary: 'Candidatar-se a uma vaga' })
  @ApiResponse({ status: 201, description: 'Candidatura criada com sucesso' })
  async apply(
    @Param('id') jobId: string,
    @Body() _dto: CreateApplicationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationResponseDto> {
    // Mesma regra do create: o profissional vem do token, não do body.
    const application = await this.applyToJobPosting.execute(
      jobId,
      req.user.id,
    );

    return new ApplicationResponseDto({
      id: application.id,
      jobId: application.jobId,
      professionalId: application.professionalId,
      createdAt: application.createdAt,
    });
  }

  @Get(':id/applications')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({ summary: 'Listar candidatos da vaga' })
  @ApiResponse({ status: 200, description: 'Lista de candidatos' })
  async listApplicants(
    @Param('id') jobId: string,
    @Query() query: ListJobApplicantsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ListJobApplicantsResponseDto> {
    // A dona da vaga é conferida no use case contra o id do token — a rota
    // não recebe restaurantId de fora.
    return this.listJobApplicants.execute({
      jobId,
      restaurantId: req.user.id,
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
  }
}
