import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Query,
  Req,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessagesService } from './message.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Save message (fallback if WS not available)
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateMessageDto) {
    return this.messagesService.create(dto);
  }

  // Get conversation between current user and otherUser
  @UseGuards(JwtAuthGuard)
  @Get('conversation/:otherUserId')
  async conversation(
    @Req() req: any,
    @Param('otherUserId') otherUserId: number,
    @Query('limit') limit = 100,
    @Query('offset') offset = 0,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const me = req.user.user_id || req.user.userId || req.user.sub;
    return this.messagesService.findConversation(
      Number(me),
      Number(otherUserId),
      Number(limit),
      Number(offset),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('mark-read/:senderId')
  async markRead(@Req() req: any, @Param('senderId') senderId: number) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const me = req.user.user_id || req.user.userId || req.user.sub;
    await this.messagesService.markAsRead(Number(me), Number(senderId));
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async unread(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const me = req.user.user_id || req.user.userId || req.user.sub;
    const c = await this.messagesService.getUnreadCount(Number(me));
    return { unread: c };
  }
}
