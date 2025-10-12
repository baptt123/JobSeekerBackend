import { Controller, Get, Query } from '@nestjs/common';
import { LivekitCustomService } from './livekit-custom.service';

@Controller('livekit')
export class LivekitCustomController {
  constructor(private readonly svc: LivekitCustomService) {}

  @Get('token')
  async getToken(
    @Query('roomName') room: string,
    @Query('identity') identity: string,
  ) {
    return await this.svc.createToken(room, identity);
  }
}
