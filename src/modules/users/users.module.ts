import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { GeocodingModule } from 'src/common/geocoding/geocoding.module';
import { UsersController } from './users.controller';
import { GetMyProfileUseCase } from './use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './use-cases/update-my-profile.use-case';
import { DeleteAccountUseCase } from './use-cases/DeleteAccountUseCase';
import { UpdateMyPhotoUseCase } from './use-cases/update-my-photo.use-case';
import { ProfilePhotoStorage } from './profile-photo/profile-photo.storage';

@Module({
  imports: [AuthModule, GeocodingModule],
  controllers: [UsersController],
  providers: [
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    DeleteAccountUseCase,
    UpdateMyPhotoUseCase,
    ProfilePhotoStorage,
  ],
})
export class UsersModule {}
