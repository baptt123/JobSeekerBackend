// src/messages/messages.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  ParseIntPipe,
  UsePipes,
  ValidationPipe,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { MessagesService } from './message.service';
import { SendMessageDto } from '../dto/send-message.dto';
import { GetConversationDto } from '../dto/get-conversation.dto';
import { MarkReadDto } from '../dto/mark-read.dto';
import { UserService } from '../user/user.service';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly userService: UserService,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async send(@Body() dto: SendMessageDto) {
    const created = await this.messagesService.sendMessage(dto);
    return { success: true, data: created };
  }

  // GET /messages/conversation?userA=1&userB=2&limit=50&offset=0
  @Get('conversation')
  @UsePipes(new ValidationPipe({ transform: true }))
  async conversation(@Query() q: GetConversationDto) {
    const { userA, userB, limit, offset } = q;
    return this.messagesService.getConversation(userA, userB, limit, offset);
  }

  // POST /messages/mark-read  { message_id, currentUserId }
  @Post('mark-read')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async markRead(@Body() dto: MarkReadDto & { currentUserId: number }) {
    // note: for testing via Postman we accept currentUserId in body; in real app take from JWT
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { message_id, currentUserId } = dto as any;
    const updated = await this.messagesService.markRead(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      message_id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      currentUserId,
    );
    return { success: true, data: updated };
  }

  // GET /messages/inbox/:userId
  @Get('inbox/:userId')
  async inbox(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const l = parseInt(limit, 10) || 50;
    const o = parseInt(offset, 10) || 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.messagesService.listConversations(userId, l, o);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { full_name: string }) {
    const { full_name } = body;
    const user = await this.userService.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.full_name) = LOWER(:full_name)', { full_name })
      .getOne();

    if (!user) throw new NotFoundException('User không tồn tại trong hệ thống');

    // ⚙️ nên trả 200 thay vì 201
    return user;
  }
}
