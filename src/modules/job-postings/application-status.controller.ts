import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { ApplicationStatusResponseDto } from './dto/application-status-response.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';
import { UpdateApplicationStatusUseCase } from './use-cases/update-application-status.use-case';

@ApiTags('Job Postings')
@ApiBearerAuth()
@Controller('vagas')
@UseGuards(AuthGuard, RolesGuard)
export class ApplicationStatusController {
  constructor(
    private readonly updateApplicationStatus: UpdateApplicationStatusUseCase,
  ) {}

  @Patch(':vagaId/candidaturas/:candidaturaId/status')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({ summary: 'Atualizar status da candidatura' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  async updateStatus(
    @Param('vagaId') vagaId: string,
    @Param('candidaturaId') candidaturaId: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationStatusResponseDto> {
    // A dona da vaga é conferida no use case contra o id do token — a rota
    // não recebe restauranteId de fora.
    const candidatura = await this.updateApplicationStatus.execute({
      jobId: vagaId,
      applicationId: candidaturaId,
      restaurantId: req.user.id,
      status: dto.status,
    });

    return new ApplicationStatusResponseDto({
      id: candidatura.id,
      jobId: candidatura.jobId,
      professionalId: candidatura.professionalId,
      status: candidatura.status,
      createdAt: candidatura.createdAt,
      updatedAt: candidatura.updatedAt,
    });
  }
}
