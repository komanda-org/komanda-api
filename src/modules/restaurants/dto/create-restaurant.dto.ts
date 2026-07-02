import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'CnpjValidator', async: false })
export class CnpjValidator implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const digits = value.replace(/\D/g, '');
    if (!/^\d{14}$/.test(digits)) {
      return false;
    }

    if (/^(\d)\1+$/.test(digits)) {
      return false;
    }

    const calcDigit = (digitString: string, length: number): number => {
      let sum = 0;
      let weight = length - 7;

      for (let i = 0; i < length - 1; i += 1) {
        sum += Number(digitString[i]) * weight;
        weight = weight === 2 ? 9 : weight - 1;
      }

      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    const firstDigit = calcDigit(digits, 13);
    const secondDigit = calcDigit(digits, 14);

    return firstDigit === Number(digits[12]) && secondDigit === Number(digits[13]);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'CNPJ inválido';
  }
}

export class CreateRestaurantDto {
  @IsEmail({}, {
    message: 'Email deve ser válido'
  })
  @MaxLength(255, {
    message: 'Email deve ter no máximo 255 caracteres'
  })
  email!: string;

  @IsString()
  @MinLength(8, {
    message: 'Senha deve ter no mínimo 8 caracteres'
  })
  @MaxLength(64, {
    message: 'Senha deve ter no máximo 64 caracteres'
  })
  password!: string;

  @IsString()
  @MinLength(3, {
    message: 'Nome do restaurante deve ter no mínimo 3 caracteres',
  })
  @MaxLength(255, {
    message: 'Nome do restaurante deve ter no máximo 255 caracteres',
  })
  restaurantName!: string;

  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, {
    message: 'CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX',
  })
  @Validate(CnpjValidator)
  cnpj!: string;

  @IsString()
  @MinLength(3, {
    message: 'Tipo de cozinha deve ter no mínimo 3 caracteres'
  })
  @MaxLength(100, {
    message: 'Tipo de cozinha deve ter no máximo 100 caracteres'
  })
  cuisineType!: string;

  @IsString()
  @MinLength(20, {
    message: 'Descrição deve ter no mínimo 20 caracteres'
  })
  @MaxLength(1024, {
    message: 'Descrição deve ter no máximo 1024 caracteres'
  })
  description!: string;

  @IsString()
  @MinLength(5, {
    message: 'Endereço deve ter no mínimo 5 caracteres'
  })
  @MaxLength(255, {
    message: 'Endereço deve ter no máximo 255 caracteres'
  })
  address!: string;

  @IsString()
  @IsNotEmpty({
    message: 'Telefone não pode ser vazio',
  })
  @MaxLength(20, {
    message: 'Telefone deve ter no máximo 20 caracteres',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty({
    message: 'CEP não pode ser vazio',
  })
  @MaxLength(10, {
    message: 'CEP deve ter no máximo 10 caracteres',
  })
  zipCode!: string;

  @IsOptional()
  @IsUrl({}, {
    message: 'URL do logo deve ser válida',
  })
  @MaxLength(2048, {
    message: 'URL do logo deve ter no máximo 2048 caracteres',
  })
  logoUrl?: string;
}
