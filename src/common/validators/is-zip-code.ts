import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

// "01001-000" ou "01001000". Os 5 primeiros dígitos são usados para achar
// profissionais da mesma região (notificação de vaga), e o CEP completo para
// calcular distância no front, então o formato precisa ser confiável.
export const ZIP_CODE_PATTERN = /^\d{5}-?\d{3}$/;

const formatRules = () => [
  IsString({ message: 'CEP é obrigatório' }),
  Matches(ZIP_CODE_PATTERN, {
    message: 'CEP deve estar no formato 00000-000',
  }),
];

// CEP obrigatório (profissional).
export function IsZipCode(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({ example: '01001-000' }),
    ...formatRules(),
  );
}

// CEP opcional (restaurante itinerante, que só trabalha em eventos).
// "" vindo de formulário vira null; se vier preenchido, o formato é cobrado.
export function IsOptionalZipCode(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      example: '01001-000',
      required: false,
      nullable: true,
      description:
        'Opcional: restaurantes que só trabalham em eventos não têm CEP',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' && value.trim() === '' ? null : value,
    ),
    IsOptional(),
    ...formatRules(),
  );
}
