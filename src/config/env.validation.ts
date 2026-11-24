import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  AUTH_LOGIN_LIMIT: Joi.number().integer().min(1).default(5),
  AUTH_LOGIN_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  RATE_LIMIT: Joi.number().integer().min(1).default(20),
  RATE_LIMIT_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
  PASSWORD_RESET_TOKEN_PEPPER: Joi.string().min(32).required(),
  DB_POOL_SIZE: Joi.number().integer().min(1).default(10),
  // false = não geocodifica CEP de restaurante (sem chamar BrasilAPI/Nominatim).
  GEOCODING_ENABLED: Joi.boolean().default(true),
});
