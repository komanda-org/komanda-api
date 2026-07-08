import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ContractType } from '@prisma/client';

export class CreateVagaDto {
	@IsString()
	@MinLength(5, {
		message: 'O titulo deve ter ao menos 5 caracteres'
	})
	@MaxLength(100, {
		message: 'O titulo não pode passar de 100 caracteres'
	})
	titulo!: string;

	@IsString()
	@MinLength(20, {
		message: 'A descrição deve ter ao menos 20 caracteres'
	})
	@MaxLength(2000, {
		message: 'A descrição não pode passar de 2000 caracteres'
	})
	descricao!: string;

	@IsString()
	@IsOptional()
	@MaxLength(1000, {
		message: 'O requisito não pode passar de 2000 caracteres'
	})
	requisitos?: string;

	@IsOptional()
	@IsNumber()
	salario?: number;

	@IsEnum(ContractType)
	tipoContrato!: ContractType;
}