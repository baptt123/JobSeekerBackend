// src/message/message.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { MessageService } from './message.service';
import { OrAuthGuard } from '../guard/or-auth.guard'; //
import { Roles } from '../decorator/role.decorator'; //

@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // API lấy danh sách những người đã chat
  @Get('partners')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async getChatPartners(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return await this.messageService.getChatPartners(userId);
  }
}
