import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Coordinates } from './haversine';

export const GEOCODER_OPTIONS = Symbol('GEOCODER_OPTIONS');

export interface GeocoderOptions {
  // false = não chama nenhuma API externa (testes, ambiente offline).
  enabled?: boolean;
  fetch?: typeof fetch;
  timeoutMs?: number;
  // Política de uso do Nominatim: no máximo 1 requisição por segundo.
  nominatimIntervalMs?: number;
}

export interface GeocodeInput {
  zipCode: string | null | undefined;
  address?: string | null;
}

const BRASIL_API_URL = 'https://brasilapi.com.br/api/cep/v2';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// User-Agent genérico do app, como o Nominatim exige (sem dado pessoal).
const USER_AGENT = 'komanda-api/1.0 (geocodificacao de CEP)';

interface BrasilApiCep {
  location?: { coordinates?: { latitude?: unknown; longitude?: unknown } };
}

type NominatimResult = { lat?: unknown; lon?: unknown }[];

/**
 * CEP -> coordenadas. Tenta a BrasilAPI (CEP v2 já traz location) e, se ela
 * não tiver coordenadas, o Nominatim (pelo CEP e depois pelo endereço).
 *
 * Nunca lança erro: qualquer falha vira null e o cadastro/edição segue.
 */
@Injectable()
export class ZipCodeGeocoder {
  private readonly logger = new Logger(ZipCodeGeocoder.name);
  private readonly enabled: boolean;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly nominatimIntervalMs: number;

  // Fila única: chamadas ao Nominatim saem uma por vez, com intervalo mínimo.
  private nominatimQueue: Promise<unknown> = Promise.resolve();
  private lastNominatimAt = 0;

  constructor(
    @Optional() @Inject(GEOCODER_OPTIONS) options: GeocoderOptions = {},
  ) {
    this.enabled = options.enabled ?? true;
    this.fetchFn =
      options.fetch ??
      ((input: string | URL | Request, init?: RequestInit) =>
        fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.nominatimIntervalMs = options.nominatimIntervalMs ?? 1100;
  }

  async geocode(input: GeocodeInput): Promise<Coordinates | null> {
    const digits = input.zipCode?.replace(/\D/g, '') ?? '';
    // Sem CEP = restaurante itinerante: não tem o que geocodificar.
    if (!this.enabled || digits.length !== 8) return null;

    try {
      const fromBrasilApi = await this.fromBrasilApi(digits);
      if (fromBrasilApi) return fromBrasilApi;

      const postalCode = `${digits.slice(0, 5)}-${digits.slice(5)}`;
      const byZip = await this.fromNominatim({
        postalcode: postalCode,
        country: 'Brazil',
      });
      if (byZip) return byZip;

      const address = input.address?.trim();
      if (address) {
        return await this.fromNominatim({ q: address, countrycodes: 'br' });
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Falha ao geocodificar CEP ${digits}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async fromBrasilApi(digits: string): Promise<Coordinates | null> {
    try {
      const body = await this.getJson<BrasilApiCep>(
        `${BRASIL_API_URL}/${digits}`,
      );
      const coords = body?.location?.coordinates;
      return toCoordinates(coords?.latitude, coords?.longitude);
    } catch (error) {
      // BrasilAPI fora do ar ou CEP desconhecido: ainda tenta o Nominatim.
      this.logger.warn(
        `BrasilAPI falhou para o CEP ${digits}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private fromNominatim(
    params: Record<string, string>,
  ): Promise<Coordinates | null> {
    const query = new URLSearchParams({
      ...params,
      format: 'jsonv2',
      limit: '1',
    });
    return this.throttleNominatim(async () => {
      const results = await this.getJson<NominatimResult>(
        `${NOMINATIM_URL}?${query.toString()}`,
      );
      const first = Array.isArray(results) ? results[0] : undefined;
      return toCoordinates(first?.lat, first?.lon);
    });
  }

  private throttleNominatim<T>(task: () => Promise<T>): Promise<T> {
    const run = this.nominatimQueue.then(async () => {
      const wait = this.lastNominatimAt + this.nominatimIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.lastNominatimAt = Date.now();
      return task();
    });
    // Uma falha não pode travar a fila para as próximas chamadas.
    this.nominatimQueue = run.catch(() => undefined);
    return run;
  }

  private async getJson<T>(url: string): Promise<T | null> {
    const response = await this.fetchFn(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  }
}

function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  // BrasilAPI e Nominatim mandam as coordenadas como string; "" ou ausente
  // quer dizer que não há.
  if (lat === undefined || lat === null || lat === '') return null;
  if (lng === undefined || lng === null || lng === '') return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}
