import { Module } from '@nestjs/common';
import { CloudinaryCustomService } from './cloudinary-custom.service';
import { CloudinaryCustomController } from './cloudinary-custom.controller';

@Module({
  controllers: [CloudinaryCustomController],
  providers: [CloudinaryCustomService],
  exports: [CloudinaryCustomService],
})
export class CloudinaryCustomModule {}
