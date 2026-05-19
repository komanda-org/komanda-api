import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
    @IsEmail()
    @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: 'Email deve ser válido'
    })
    email: string;

    @IsString()
    @MinLength(8, {
        message: 'Senha deve ter no minimo 8 caracteres'
    })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: 'Senha deve ter letra maiúscula, minúscula, e número'
    })
    password: string;
}