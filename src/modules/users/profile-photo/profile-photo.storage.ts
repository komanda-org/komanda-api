import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ImageExtension = 'jpg' | 'png' | 'webp';

// Pasta servida em /uploads pelo main.ts. Fora do git (.gitignore).
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
export const UPLOADS_ROUTE = '/uploads';
const PHOTOS_DIR = 'profile-photos';

// A URL salva no banco é absoluta, porque o front (outra origem) usa direto no
// <img src>. Em produção, API_PUBLIC_URL é o endereço público da API.
function publicBaseUrl(): string {
  const configured = process.env.API_PUBLIC_URL?.replace(/\/+$/, '');
  return configured || `http://localhost:${process.env.PORT ?? 3000}`;
}

@Injectable()
export class ProfilePhotoStorage {
  private readonly logger = new Logger(ProfilePhotoStorage.name);

  async save(buffer: Buffer, extension: ImageExtension): Promise<string> {
    const dir = join(UPLOADS_ROOT, PHOTOS_DIR);
    await mkdir(dir, { recursive: true });
    // Nome aleatório: o nome original do arquivo nunca chega ao disco.
    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(join(dir, fileName), buffer);
    return `${publicBaseUrl()}${UPLOADS_ROUTE}/${PHOTOS_DIR}/${fileName}`;
  }

  // Apaga só arquivos que esta API gravou; URL externa (cadastro antigo) é
  // ignorada. Falha ao apagar não quebra o fluxo: vira só um arquivo órfão.
  async removeIfOwned(url: string | null | undefined): Promise<void> {
    const fileName = this.ownedFileName(url);
    if (!fileName) return;
    try {
      await unlink(join(UPLOADS_ROOT, PHOTOS_DIR, fileName));
    } catch (error) {
      this.logger.warn(
        `Não foi possível apagar a foto antiga ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private ownedFileName(url: string | null | undefined): string | null {
    if (!url) return null;
    const prefix = `${publicBaseUrl()}${UPLOADS_ROUTE}/${PHOTOS_DIR}/`;
    if (!url.startsWith(prefix)) return null;
    const fileName = url.slice(prefix.length);
    // Só o formato que o save() gera: impede path traversal (../).
    return /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(fileName) ? fileName : null;
  }
}

// Confere a assinatura do arquivo (magic bytes) em vez de confiar no
// Content-Type enviado pelo cliente.
export function detectImageExtension(buffer: Buffer): ImageExtension | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpg';
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
