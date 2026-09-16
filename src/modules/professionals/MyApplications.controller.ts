import {
  Controller,
  Get,
  Query,
  Req,
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
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ListMyApplicationsQueryDto } from './dto/list-my-applications-query.dto';
import { ListMyApplicationsResponseDto } from './dto/my-application-response.dto';
import { ListMyApplicationsUseCase } from './use-cases/list-my-applications.use-case';

@ApiTags('Professionals')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class MyApplicationsController {
  constructor(
    private readonly listMyApplicationsUseCase: ListMyApplicationsUseCase,
  ) {}

  @Get('me/applications')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.PROFISSIONAL)
  @ApiOperation({ summary: 'Listar minhas candidaturas' })
  @ApiResponse({ status: 200, description: 'Lista de candidaturas' })
  async listMyApplications(
    @Query() query: ListMyApplicationsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ListMyApplicationsResponseDto> {
    // O id do profissional vem do token (middleware de autenticação),
    // nunca de parâmetro de rota ou body.
    return this.listMyApplicationsUseCase.execute({
      professionalId: req.user.id,
      status: query.status,
      skip: query.skip,
      take: query.take,
    });
  }
}
