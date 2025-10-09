import { Module } from '@nestjs/common';
import { CloudinaryCustomService } from './cloudinary-custom.service';
import { CloudinaryCustomController } from './cloudinary-custom.controller';
import { CloudinaryProvider } from './cloudinary-custom.provider';

@Module({
  controllers: [CloudinaryCustomController],
  providers: [CloudinaryCustomService, CloudinaryProvider],
  exports: [CloudinaryCustomService, CloudinaryProvider],
})
export class CloudinaryCustomModule {}
