import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateApplicationDto } from './create-application.dto';

// Recriamos aqui o MESMO pipe configurado globalmente em src/main.ts.
// Assim testamos o contrato de validação de forma isolada, sem precisar
// subir o app inteiro (nem banco, nem auth): validamos só a regra do body.
describe('CreateApplicationDto — contrato de body vazio', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  // Metadata simula como o Nest entrega o body ao pipe: qual classe (metatype)
  // ele deve usar para validar aquele argumento anotado com @Body().
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateApplicationDto,
    data: undefined,
  };

  it('rejeita com 400 quando o body traz campos não previstos', async () => {
    // Regressão do problema apontado no PR #17 e no review do KMD-33.
    await expect(pipe.transform({ x: 1 }, metadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('aceita um body vazio (fluxo esperado)', async () => {
    const result = await pipe.transform({}, metadata);
    expect(result).toEqual({});
  });
});
