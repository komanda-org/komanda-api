process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://user:password@localhost:5432/komanda_test?schema=public';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';
process.env.AUTH_LOGIN_LIMIT = process.env.AUTH_LOGIN_LIMIT ?? '2';
process.env.AUTH_LOGIN_TTL_SECONDS = process.env.AUTH_LOGIN_TTL_SECONDS ?? '60';
process.env.PASSWORD_RESET_TOKEN_PEPPER =
  process.env.PASSWORD_RESET_TOKEN_PEPPER ?? 'test-pepper';
