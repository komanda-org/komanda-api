import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ApplicationStatusController } from './application-status.controller';
import { JobPostingsController } from './job-postings.controller';
import { ApplyToJobPostingUseCase } from './use-cases/apply-to-job-posting.use-case';
import { CreateJobPostingUseCase } from './use-cases/create-job-posting.use-case';
import { ListJobApplicantsUseCase } from './use-cases/list-job-applicants.use-case';
import { UpdateApplicationStatusUseCase } from './use-cases/update-application-status.use-case';

// PrismaModule é @Global, então não precisa ser importado aqui.
// AuthModule sim: os guards presos no controller são instanciados no contexto
// deste módulo, e o AuthGuard depende do JwtService.
@Module({
  imports: [AuthModule],
  controllers: [JobPostingsController, ApplicationStatusController],
  providers: [
    CreateJobPostingUseCase,
    ApplyToJobPostingUseCase,
    ListJobApplicantsUseCase,
    UpdateApplicationStatusUseCase,
  ],
})
export class JobPostingsModule {}
