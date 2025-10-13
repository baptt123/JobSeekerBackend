import { Controller, Post, Body } from '@nestjs/common';
import { ZoomService } from './zoom.service';

@Controller('zoom')
export class ZoomController {
  constructor(private readonly zoomService: ZoomService) {}

  @Post('create-meeting')
  async createMeeting(@Body('topic') topic: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const meeting = await this.zoomService.createMeeting(topic);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      meetingId: meeting.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      joinUrl: meeting.join_url,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      startUrl: meeting.start_url,
    };
  }
}
