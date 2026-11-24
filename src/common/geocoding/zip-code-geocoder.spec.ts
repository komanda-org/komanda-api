import { Logger } from '@nestjs/common';
import { ZipCodeGeocoder } from './zip-code-geocoder';

const json = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

const brasilApi = (latitude: unknown, longitude: unknown) =>
  json({ cep: '40020000', location: { coordinates: { latitude, longitude } } });

describe('ZipCodeGeocoder', () => {
  let fetchMock: jest.Mock<Promise<Response>, [string, RequestInit]>;
  let geocoder: ZipCodeGeocoder;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    fetchMock = jest.fn<Promise<Response>, [string, RequestInit]>();
    geocoder = new ZipCodeGeocoder({
      fetch: fetchMock,
      nominatimIntervalMs: 0,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('usa as coordenadas da BrasilAPI CEP v2', async () => {
    fetchMock.mockResolvedValue(brasilApi('-12.97', '-38.50'));

    await expect(geocoder.geocode({ zipCode: '40020-000' })).resolves.toEqual({
      latitude: -12.97,
      longitude: -38.5,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://brasilapi.com.br/api/cep/v2/40020000',
    );
  });

  it('cai no Nominatim pelo CEP quando a BrasilAPI vem sem coordenadas', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ cep: '40020000', location: {} }))
      .mockResolvedValueOnce(json([{ lat: '-12.9', lon: '-38.4' }]));

    await expect(geocoder.geocode({ zipCode: '40020000' })).resolves.toEqual({
      latitude: -12.9,
      longitude: -38.4,
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('postalcode=40020-000');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(
      /^komanda-api\//,
    );
  });

  it('tenta o endereço no Nominatim se o CEP não achou nada', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ message: 'CEP não encontrado' }, 404))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json([{ lat: '-16.44', lon: '-39.06' }]));

    await expect(
      geocoder.geocode({ zipCode: '45810-000', address: 'Av. Beira Mar, 1' }),
    ).resolves.toEqual({ latitude: -16.44, longitude: -39.06 });
    expect(fetchMock.mock.calls[2][0]).toContain('q=Av.+Beira+Mar%2C+1');
  });

  it('devolve null, sem lançar, quando as APIs externas falham', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(json({}, 503));

    await expect(
      geocoder.geocode({ zipCode: '40020-000', address: 'Rua X' }),
    ).resolves.toBeNull();
  });

  it('devolve null para coordenada fora do intervalo', async () => {
    fetchMock
      .mockResolvedValueOnce(brasilApi('123', '-38'))
      .mockResolvedValueOnce(json([]));

    await expect(
      geocoder.geocode({ zipCode: '40020-000' }),
    ).resolves.toBeNull();
  });

  it.each([null, undefined, '', '123'])(
    'não chama API sem CEP válido (%p, itinerante)',
    async (zipCode) => {
      await expect(geocoder.geocode({ zipCode })).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('não chama API quando desligado', async () => {
    const off = new ZipCodeGeocoder({ enabled: false, fetch: fetchMock });

    await expect(off.geocode({ zipCode: '40020-000' })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('espaça as chamadas ao Nominatim pelo intervalo mínimo', async () => {
    const throttled = new ZipCodeGeocoder({
      fetch: fetchMock,
      nominatimIntervalMs: 200,
    });
    const nominatimCalls: number[] = [];
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('brasilapi')) return Promise.resolve(json({}, 404));
      nominatimCalls.push(Date.now());
      return Promise.resolve(json([{ lat: '1', lon: '1' }]));
    });

    await Promise.all([
      throttled.geocode({ zipCode: '40020-000' }),
      throttled.geocode({ zipCode: '40020-001' }),
    ]);

    expect(nominatimCalls).toHaveLength(2);
    // Tolerância pequena para o arredondamento do setTimeout.
    expect(nominatimCalls[1] - nominatimCalls[0]).toBeGreaterThanOrEqual(190);
  });
});
