import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * KMD-109: o CLI do Prisma é tooling de build/migração, não runtime da API.
 * Em `dependencies` ele entra na imagem de produção e no scan de vulnerabilidades.
 */
type PackageJson = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8'),
) as PackageJson;

describe('package.json dependencies', () => {
  it('keeps the Prisma CLI out of production dependencies', () => {
    expect(pkg.dependencies).not.toHaveProperty('prisma');
    expect(pkg.devDependencies).toHaveProperty('prisma');
    expect(pkg.dependencies).toHaveProperty('@prisma/client');
  });
});
