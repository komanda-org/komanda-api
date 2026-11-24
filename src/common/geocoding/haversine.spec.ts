import { haversineKm, roundKm } from './haversine';

describe('haversineKm', () => {
  it('é zero no mesmo ponto', () => {
    const p = { latitude: -12.97, longitude: -38.5 };
    expect(haversineKm(p, p)).toBe(0);
  });

  it('1 grau de latitude vale ~111,2 km', () => {
    expect(
      haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }),
    ).toBeCloseTo(111.19, 1);
  });

  it('Salvador → Porto Seguro fica perto de 390 km em linha reta', () => {
    const km = haversineKm(
      { latitude: -12.9714, longitude: -38.5014 },
      { latitude: -16.4497, longitude: -39.0648 },
    );
    expect(km).toBeGreaterThan(380);
    expect(km).toBeLessThan(400);
  });
});

describe('roundKm', () => {
  it('arredonda em 1 casa', () => {
    expect(roundKm(1.149)).toBe(1.1);
    expect(roundKm(1.16)).toBe(1.2);
    expect(roundKm(0.04)).toBe(0);
  });
});
