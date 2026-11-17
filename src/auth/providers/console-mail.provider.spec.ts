import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleMailProvider } from './console-mail.provider';

const configWith = (nodeEnv: string) =>
  ({ get: () => nodeEnv }) as unknown as ConfigService;

describe('ConsoleMailProvider', () => {
  it('não loga o token de recuperação', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const provider = new ConsoleMailProvider(configWith('development'));
    const token = 'a3f1c2d4-super-secreto';

    await provider.sendPasswordRecoveryEmail({
      to: 'fulano@example.com',
      token,
    });

    const logged = log.mock.calls.flat().join(' ');
    expect(logged).not.toContain(token);
    expect(logged).toContain('f***@example.com');
    log.mockRestore();
  });

  it('falha ao ser instanciado em produção', () => {
    expect(() => new ConsoleMailProvider(configWith('production'))).toThrow(
      /produção/,
    );
  });
});
