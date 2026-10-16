import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateDenunciaDto } from './create-denuncia.dto';

// MESMO pipe global de src/main.ts — valida só o contrato do body, sem subir app.
describe('CreateDenunciaDto — targetType da RF10', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateDenunciaDto,
    data: undefined,
  };

  const validBody = {
    targetType: 'PERFIL',
    targetId: 'user-1',
    reason: 'Perfil falso',
  };

  it('aceita um payload válido', async () => {
    const result = (await pipe.transform(validBody, metadata)) as unknown;
    expect(result).toEqual(validBody);
  });

  it('rejeita targetType fora de perfil/vaga/mensagem com 400', async () => {
    await expect(
      pipe.transform({ ...validBody, targetType: 'CHAT' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita body vazio com 400', async () => {
    await expect(pipe.transform({}, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejeita campos não previstos com 400', async () => {
    await expect(
      pipe.transform({ ...validBody, status: 'RESOLVIDA' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
