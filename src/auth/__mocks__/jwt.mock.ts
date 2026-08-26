export const createMockJwtService = () => ({
  sign: jest
    .fn()
    .mockReturnValue(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInJvbGUiOiJQUk9GSVNTSU9OQUwifQ.test',
    ),
  verify: jest.fn(),
});

export type MockJwtService = ReturnType<typeof createMockJwtService>;
