import { Module } from '@nestjs/common';
import { JobsController } from './Jobs.controller';
import { SearchJobsUseCase } from './use-cases/search-jobs.use-case';
import { GetJobByIdUseCase } from './use-cases/get-job-by-id.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [JobsController],
  providers: [SearchJobsUseCase, GetJobByIdUseCase],
})
export class JobsModule {}
