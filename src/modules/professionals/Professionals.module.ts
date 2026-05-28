import { Module } from '@nestjs/common';
import { ProfessionalsController } from './Professionals.controller'; 
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [ProfessionalsController],
    providers: [RegisterProfessionalUseCase]
})

export class ProfessionalsModule {}