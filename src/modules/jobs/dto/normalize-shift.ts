import { TransformFnParams } from 'class-transformer';

// Turno é texto livre no MVP (sem enum), então "noite", " Noite" e "NOITE"
// precisam virar o mesmo valor — tanto ao gravar a vaga quanto ao filtrar.
// String vazia vira undefined para o @IsOptional tratar como "sem filtro".
export function normalizeShift({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toUpperCase();
  return normalized === '' ? undefined : normalized;
}
