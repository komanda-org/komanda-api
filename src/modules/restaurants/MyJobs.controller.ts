import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import type { AuthenticatedRequest } from 'src/auth/interfaces/authenticated-request.interface';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ListMyJobsQueryDto } from './dto/list-my-jobs-query.dto';
import { ListMyJobsResponseDto } from './dto/my-job-response.dto';
import { ListMyJobsUseCase } from './use-cases/list-my-jobs.use-case';

@Controller('restaurantes')
@UseGuards(AuthGuard, RolesGuard)
export class MyJobsController {
  constructor(private readonly listMyJobsUseCase: ListMyJobsUseCase) {}

  @Get('me/vagas')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.RESTAURANTE)
  async listMyJobs(
    @Query() query: ListMyJobsQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ListMyJobsResponseDto> {
    // restauranteId vem do token, nunca da query — o gestor só vê as vagas
    // que ele mesmo publicou.
    return this.listMyJobsUseCase.execute({
      restauranteId: req.user.id,
      skip: query.skip,
      take: query.take,
    });
  }
}
