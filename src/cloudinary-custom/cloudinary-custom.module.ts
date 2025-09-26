import { Module } from '@nestjs/common';
import { CloudinaryCustomService } from './cloudinary-custom.service';
import { CloudinaryCustomController } from './cloudinary-custom.controller';

@Module({
  controllers: [CloudinaryCustomController],
  providers: [CloudinaryCustomService],
})
export class CloudinaryCustomModule {}
