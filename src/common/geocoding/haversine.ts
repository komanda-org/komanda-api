import { Prisma } from '@prisma/client';

export const EARTH_RADIUS_KM = 6371;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Distância em linha reta (grande círculo) entre dois pontos, em km.
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Mesma fórmula de haversineKm, em SQL, para filtrar e ordenar no banco.
// `latColumn`/`lngColumn` são colunas fixas do código, nunca entrada do usuário.
export function haversineKmSql(
  origin: Coordinates,
  latColumn: string,
  lngColumn: string,
): Prisma.Sql {
  const lat = Prisma.raw(latColumn);
  const lng = Prisma.raw(lngColumn);
  return Prisma.sql`(2 * ${EARTH_RADIUS_KM}::float8 * asin(least(1, sqrt(
    power(sin(radians(${lat} - ${origin.latitude}::float8) / 2), 2)
    + cos(radians(${origin.latitude}::float8)) * cos(radians(${lat}))
      * power(sin(radians(${lng} - ${origin.longitude}::float8) / 2), 2)
  ))))`;
}

export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}
