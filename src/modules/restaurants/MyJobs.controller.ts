import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ListMyJobsQueryDto } from './dto/list-my-jobs-query.dto';
import { ListMyJobsResponseDto } from './dto/my-job-response.dto';
import { ListMyJobsUseCase } from './use-cases/list-my-jobs.use-case';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class MyJobsController {
  constructor(private readonly listMyJobsUseCase: ListMyJobsUseCase) {}

  @Get('me/jobs')
  @SkipThrottle() // leitura autenticada de tela; ver notifications.controller
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  @ApiOperation({
    summary: 'Vagas publicadas pelo restaurante logado (todos os status)',
  })
  @ApiResponse({ status: 200, description: 'Página de vagas' })
  @ApiResponse({ status: 403, description: 'Usuário logado não é restaurante' })
  async listMyJobs(
    @Query() query: ListMyJobsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ListMyJobsResponseDto> {
    // restaurantId vem do token, nunca da query — o gestor só vê as vagas
    // que ele mesmo publicou.
    return this.listMyJobsUseCase.execute({
      restaurantId: req.user.id,
      skip: query.skip,
      take: query.take,
    });
  }
}
