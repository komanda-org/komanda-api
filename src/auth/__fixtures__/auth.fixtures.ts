import { Role } from '@prisma/client';

export const USER_FIXTURE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
  role: 'PROFISSIONAL' as Role,
  createdAt: new Date('2026-05-19'),
  updatedAt: new Date('2026-05-19'),
  deletedAt: null,
  active: true,
};

export const USER_FIXTURE_DELETED = {
  ...USER_FIXTURE,
  deletedAt: new Date('2026-05-18'),
};

export const USER_FIXTURE_INACTIVE = {
  ...USER_FIXTURE,
  active: false,
};

export const LOGIN_DTO_FIXTURE = {
  email: 'test@example.com',
  password: 'password123',
};

export const LOGIN_DTO_INVALID_PASS = {
  email: 'test@example.com',
  password: 'wrongpassword',
};

export const LOGIN_DTO_INVALID_EMAIL = {
  email: 'notfound@example.com',
  password: 'password123',
};

export const JWT_TOKEN_FIXTURE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInJvbGUiOiJQUk9GSVNTSU9OQUwiLCJpYXQiOjE2MzEzNjQ3NTAsImV4cCI6MTYzMTk2OTU1MH0.sig';
