import {
  Controller,
  Post,
  Body,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ZoomService } from './zoom.service';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { CreateMeetingDto } from '../dto/create-meeting.dto';

@Controller('zoom')
export class ZoomController {
  constructor(private readonly zoomService: ZoomService) {}

  /**
   * Endpoint này thường được gọi độc lập để test,
   * hoặc gọi từ Frontend khi Recruiter muốn tạo nhanh link Zoom mà không thông qua flow phỏng vấn.
   */
  @Post('create-meeting')
  @UseGuards(OrAuthGuard) // 🛡️ Bảo vệ route
  @Roles('RECRUITER', 'ADMIN') // 🛡️ Chỉ Recruiter/Admin được tạo
  async createMeeting(
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateMeetingDto,
  ) {
    return await this.zoomService.createMeeting(dto);
  }
}
