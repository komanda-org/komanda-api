import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { RegisterProfessionalUseCase } from './use-cases/register-professional.use-case';   

@Controller('professionals')
export class ProfessionalsController {

    constructor(
        private readonly registerProfessionalUseCase: RegisterProfessionalUseCase
    ){}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() dto: CreateProfessionalDto) {
        return await this.registerProfessionalUseCase.execute(dto);
    }
}