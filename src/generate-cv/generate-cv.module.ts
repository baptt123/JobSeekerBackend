import { Module } from '@nestjs/common';
import { GenerateCvService } from './generate-cv.service';
import { GenerateCvController } from './generate-cv.controller';

@Module({
  controllers: [GenerateCvController],
  providers: [GenerateCvService],
})
export class GenerateCvModule {}
