import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { SendMessageDto } from './send-message.dto';

// Recriamos aqui o MESMO pipe configurado globalmente em src/main.ts.
// Assim testamos o contrato de validação do body de forma isolada, sem
// precisar subir o app inteiro (nem banco, nem auth): validamos só a regra
// do body e garantimos que content vazio/inválido gera 400 (e não 500).
describe('SendMessageDto — contrato de body', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: SendMessageDto,
    data: undefined,
  };

  it('rejeita com 400 quando content está vazio', async () => {
    await expect(
      pipe.transform({ content: '' }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita com 400 quando content não é uma string', async () => {
    await expect(
      pipe.transform({ content: 123 }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita com 400 quando o body traz campos não previstos', async () => {
    await expect(
      pipe.transform({ content: 'Oi', campoInexistente: 1 }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita um content válido', async () => {
    await expect(
      pipe.transform({ content: 'Oi, tudo bem?' }, metadata),
    ).resolves.toEqual({ content: 'Oi, tudo bem?' });
  });
});
