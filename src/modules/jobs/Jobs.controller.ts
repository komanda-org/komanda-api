import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from 'src/auth/auth.guard';
import { Roles } from 'src/auth/roles.decorator';
import { RolesGuard } from 'src/auth/roles.guard';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { ListJobsUseCase } from './use-cases/list-jobs.use-case';

@Controller('vagas')
@UseGuards(AuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly listJobsUseCase: ListJobsUseCase) {}

  @Get()
  @Roles(Role.PROFISSIONAL)
  @HttpCode(HttpStatus.OK)
  async listJobs(@Query() query: ListJobsQueryDto) {
    return await this.listJobsUseCase.execute(query);
  }
}
