/**
 * Preenche latitude/longitude dos restaurantes que já existiam antes da
 * geocodificação no cadastro (npm run db:backfill-coordinates).
 *
 * Por padrão só pega restaurantes com CEP e sem coordenadas. Com --all,
 * geocodifica de novo todos os que têm CEP. Itinerantes (sem CEP) ficam null.
 *
 * Pode rodar quantas vezes quiser. As chamadas ao Nominatim respeitam o limite
 * de 1 req/s, então uma base grande demora alguns minutos.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { ZipCodeGeocoder } from '../src/common/geocoding/zip-code-geocoder';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido (.env)');

  const all = process.argv.includes('--all');
  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  const geocoder = new ZipCodeGeocoder();

  try {
    const where: Prisma.RestaurantWhereInput = {
      zipCode: { not: null },
      ...(all ? {} : { OR: [{ latitude: null }, { longitude: null }] }),
    };
    const restaurants = await prisma.restaurant.findMany({
      where,
      select: {
        userId: true,
        restaurantName: true,
        zipCode: true,
        address: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`${restaurants.length} restaurante(s) para geocodificar.`);
    let found = 0;

    // Um por vez: a fila do geocodificador já espaça o Nominatim.
    for (const r of restaurants) {
      const coordinates = await geocoder.geocode({
        zipCode: r.zipCode,
        address: r.address,
      });
      if (coordinates) found++;

      await prisma.restaurant.update({
        where: { userId: r.userId },
        data: {
          latitude: coordinates?.latitude ?? null,
          longitude: coordinates?.longitude ?? null,
        },
      });

      console.log(
        `${coordinates ? 'ok  ' : 'sem '} ${r.zipCode} ${r.restaurantName}` +
          (coordinates
            ? ` -> ${coordinates.latitude}, ${coordinates.longitude}`
            : ''),
      );
    }

    console.log(
      `\nPronto: ${found} com coordenadas, ${restaurants.length - found} sem.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
