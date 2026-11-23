import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { PrismaService } from 'src/prisma/prisma.service';
import {
  ProfilePhotoStorage,
  detectImageExtension,
} from '../profile-photo/profile-photo.storage';
import {
  MAX_PHOTO_BYTES,
  UpdateMyPhotoUseCase,
} from './update-my-photo.use-case';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP'),
]);

const professional = { id: 'prof-1', role: Role.PROFISSIONAL } as never;
const restaurant = { id: 'rest-1', role: Role.RESTAURANTE } as never;

const createMockPrisma = () => ({
  professional: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ profilePhoto: 'old-url', deletedAt: null }),
    update: jest.fn().mockResolvedValue({}),
  },
  restaurant: {
    findUnique: jest
      .fn()
      .mockResolvedValue({ logoUrl: 'old-logo', deletedAt: null }),
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('detectImageExtension', () => {
  it('reconhece JPG, PNG e WEBP pela assinatura', () => {
    expect(detectImageExtension(JPG)).toBe('jpg');
    expect(detectImageExtension(PNG)).toBe('png');
    expect(detectImageExtension(WEBP)).toBe('webp');
  });

  it('recusa o que não é imagem, mesmo com nome .png', () => {
    expect(detectImageExtension(Buffer.from('<svg></svg>'))).toBeNull();
    expect(detectImageExtension(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageExtension(Buffer.alloc(0))).toBeNull();
  });
});

describe('UpdateMyPhotoUseCase', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let storage: { save: jest.Mock; removeIfOwned: jest.Mock };
  let useCase: UpdateMyPhotoUseCase;

  beforeEach(() => {
    prisma = createMockPrisma();
    storage = {
      save: jest.fn().mockResolvedValue('new-url'),
      removeIfOwned: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new UpdateMyPhotoUseCase(
      prisma as unknown as PrismaService,
      storage as unknown as ProfilePhotoStorage,
    );
  });

  it('profissional: grava a imagem, salva em profilePhoto e apaga a anterior', async () => {
    await expect(
      useCase.upload(professional, { buffer: PNG, size: PNG.length }),
    ).resolves.toEqual({ url: 'new-url' });

    expect(storage.save).toHaveBeenCalledWith(PNG, 'png');
    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { userId: 'prof-1' },
      data: { profilePhoto: 'new-url' },
    });
    expect(storage.removeIfOwned).toHaveBeenCalledWith('old-url');
  });

  it('restaurante: salva em logoUrl', async () => {
    await useCase.upload(restaurant, { buffer: JPG, size: JPG.length });

    expect(prisma.restaurant.update).toHaveBeenCalledWith({
      where: { userId: 'rest-1' },
      data: { logoUrl: 'new-url' },
    });
    expect(storage.removeIfOwned).toHaveBeenCalledWith('old-logo');
  });

  it.each([
    ['sem arquivo', undefined],
    ['arquivo vazio', { buffer: Buffer.alloc(0), size: 0 }],
    ['acima de 5 MB', { buffer: PNG, size: MAX_PHOTO_BYTES + 1 }],
    ['formato inválido', { buffer: Buffer.from('nao e imagem'), size: 12 }],
  ])('400 para %s, sem gravar nada', async (_caso, file) => {
    await expect(useCase.upload(professional, file)).rejects.toThrow(
      BadRequestException,
    );
    expect(storage.save).not.toHaveBeenCalled();
    expect(prisma.professional.update).not.toHaveBeenCalled();
  });

  it('404 quando o perfil foi excluído', async () => {
    prisma.professional.findUnique.mockResolvedValue({
      profilePhoto: null,
      deletedAt: new Date(),
    });

    await expect(
      useCase.upload(professional, { buffer: PNG, size: PNG.length }),
    ).rejects.toThrow(NotFoundException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('se o banco falhar, apaga o arquivo novo e mantém a foto antiga', async () => {
    prisma.professional.update.mockRejectedValue(new Error('db down'));

    await expect(
      useCase.upload(professional, { buffer: PNG, size: PNG.length }),
    ).rejects.toThrow('db down');
    expect(storage.removeIfOwned).toHaveBeenCalledWith('new-url');
    expect(storage.removeIfOwned).not.toHaveBeenCalledWith('old-url');
  });

  it('remove: zera a foto e apaga o arquivo anterior', async () => {
    await useCase.remove(professional);

    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { userId: 'prof-1' },
      data: { profilePhoto: null },
    });
    expect(storage.removeIfOwned).toHaveBeenCalledWith('old-url');
  });
});

describe('ProfilePhotoStorage.removeIfOwned', () => {
  it('ignora URL externa e nome fora do padrão (path traversal)', async () => {
    const storage = new ProfilePhotoStorage();
    // Não deve lançar nem tentar apagar nada fora da pasta de fotos.
    await expect(
      storage.removeIfOwned('https://exemplo.com/foto.png'),
    ).resolves.toBeUndefined();
    await expect(
      storage.removeIfOwned(
        'http://localhost:3000/uploads/profile-photos/../../.env',
      ),
    ).resolves.toBeUndefined();
  });
});
