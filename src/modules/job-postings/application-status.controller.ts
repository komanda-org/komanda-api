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
@Controller('jobs')
@UseGuards(AuthGuard, RolesGuard)
export class ApplicationStatusController {
  constructor(
    private readonly updateApplicationStatus: UpdateApplicationStatusUseCase,
  ) {}

  @Patch(':jobId/applications/:applicationId/status')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({ summary: 'Atualizar status da candidatura' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  async updateStatus(
    @Param('jobId') jobId: string,
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationStatusResponseDto> {
    // A dona da vaga é conferida no use case contra o id do token — a rota
    // não recebe restaurantId de fora.
    const application = await this.updateApplicationStatus.execute({
      jobId,
      applicationId,
      restaurantId: req.user.id,
      status: dto.status,
    });

    return new ApplicationStatusResponseDto({
      id: application.id,
      jobId: application.jobId,
      professionalId: application.professionalId,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    });
  }
}
