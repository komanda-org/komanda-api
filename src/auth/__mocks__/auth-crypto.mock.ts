export const createMockAuthCryptoService = () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  signToken: jest
    .fn()
    .mockReturnValue(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInJvbGUiOiJQUk9GSVNTSU9OQUwifQ.test',
    ),
});

export type MockAuthCryptoService = ReturnType<
  typeof createMockAuthCryptoService
>;
