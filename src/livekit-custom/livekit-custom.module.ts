import { Module } from '@nestjs/common';
import { LivekitCustomService } from './livekit-custom.service';
import { LivekitCustomController } from './livekit-custom.controller';

@Module({
  controllers: [LivekitCustomController],
  providers: [LivekitCustomService],
})
export class LivekitCustomModule {}
