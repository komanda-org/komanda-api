import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GEOCODER_OPTIONS,
  GeocoderOptions,
  ZipCodeGeocoder,
} from './zip-code-geocoder';

// Um único ZipCodeGeocoder na aplicação: a fila do Nominatim (1 req/s) só
// funciona se cadastro e edição de restaurante usarem a mesma instância.
@Module({
  providers: [
    {
      provide: GEOCODER_OPTIONS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): GeocoderOptions => ({
        // Joi converte para boolean; String() cobre quem lê o env cru.
        enabled: String(config.get('GEOCODING_ENABLED')) !== 'false',
      }),
    },
    ZipCodeGeocoder,
  ],
  exports: [ZipCodeGeocoder],
})
export class GeocodingModule {}
