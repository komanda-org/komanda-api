export const createMockPrismaService = () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
});

export type MockPrismaService = ReturnType<typeof createMockPrismaService>;
