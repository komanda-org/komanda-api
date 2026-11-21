import { envValidationSchema } from './env.validation';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  JWT_SECRET: 'a'.repeat(32),
  PASSWORD_RESET_TOKEN_PEPPER: 'b'.repeat(32),
};

const validate = (overrides: Record<string, string>) =>
  envValidationSchema.validate({ ...validEnv, ...overrides });

describe('envValidationSchema', () => {
  it('accepts secrets with at least 32 characters', () => {
    expect(validate({}).error).toBeUndefined();
  });

  it.each(['JWT_SECRET', 'PASSWORD_RESET_TOKEN_PEPPER'])(
    'rejects %s shorter than 32 characters',
    (key) => {
      const { error } = validate({ [key]: 'short-secret' });

      expect(error?.message).toContain(key);
    },
  );

  it.each([
    ['JWT_SECRET', 'uma-string-forte-aqui'],
    ['PASSWORD_RESET_TOKEN_PEPPER', 'troque-por-uma-string-aleatoria'],
  ])('rejects the .env.example placeholder for %s', (key, placeholder) => {
    expect(validate({ [key]: placeholder }).error).toBeDefined();
  });
});
