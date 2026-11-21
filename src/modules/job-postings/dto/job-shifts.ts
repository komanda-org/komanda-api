import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { JobShift } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';

const SHIFT_VALUES = Object.values(JobShift).join(', ');

// " manha " → "MANHA"; null → [] (apaga os turnos). Outros tipos seguem
// como vieram para o @IsArray recusar.
function normalizeShifts({ value }: { value: unknown }): unknown {
  if (value === null) return [];
  if (!Array.isArray(value)) return value;
  return value.map((item: unknown) =>
    typeof item === 'string' ? item.trim().toUpperCase() : item,
  );
}

// INTEGRAL já é o dia todo: combinar com MANHA/TARDE/NOITE seria contraditório.
function IntegralIsExclusive(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'integralIsExclusive',
      validator: {
        validate: (value: unknown) =>
          !Array.isArray(value) ||
          !value.includes(JobShift.INTEGRAL) ||
          value.length === 1,
        defaultMessage: () =>
          'INTEGRAL não pode ser combinado com outros turnos',
      },
    },
    options,
  );
}

// Lista de turnos da vaga (cadastro e edição). Vazia = não informado.
export function IsJobShifts(): PropertyDecorator {
  return applyDecorators(
    ApiProperty({
      required: false,
      isArray: true,
      enum: JobShift,
      example: [JobShift.MANHA, JobShift.TARDE],
      description:
        'Um ou mais turnos. INTEGRAL não se combina com os outros. [] ou null apaga.',
    }),
    Transform(normalizeShifts),
    IsArray({ message: 'Os turnos devem ser uma lista' }),
    ArrayUnique({ message: 'Os turnos não podem se repetir' }),
    IsEnum(JobShift, {
      each: true,
      message: `Turno inválido. Use: ${SHIFT_VALUES}`,
    }),
    IntegralIsExclusive(),
  );
}
