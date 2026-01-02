import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  UseGuards,
  Patch,
  Param,
  Req,
} from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
import { GetUser } from '../decorator/get-user.decorator';

@Controller('firebase')
export class FirebaseModuleController {
  constructor(private readonly firebaseService: FirebaseModuleService) {}

  @Post('send-test')
  @UseGuards(OrAuthGuard)
  @Roles('ADMIN')
  async sendTestNotification(@Body(ValidationPipe) dto: SendNotificationDto) {
    try {
      const messageId = await this.firebaseService.sendPushNotification(dto);
      return {
        success: true,
        message: 'Gửi thông báo thành công.',
        messageId: messageId,
      };
    } catch (error) {
      return {
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        message: error.message || 'Thất bại trong việc gửi thông báo.',
      };
    }
  }

  @Get('notifications')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async getNotifications(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    // 🔥 DEBUG: Xem Backend đang nhận ID là bao nhiêu
    console.log(
      '>>> API getNotifications CALLED by User ID:',
      userId,
      typeof userId,
    );

    try {
      const notifications = await this.firebaseService.getNotifications(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        userId,
      );
      console.log(
        `>>> Tìm thấy ${notifications.length} thông báo cho user ${userId}`,
      );

      const unreadCount = notifications.filter((n) => !n.is_read).length;

      return {
        success: true,
        data: notifications,
        unreadCount: unreadCount,
      };
    } catch (error) {
      console.error(error);
      return { success: false, message: 'Lỗi lấy thông báo' };
    }
  }

  // [NEW] API Đánh dấu 1 thông báo đã đọc
  @Patch('notifications/:id/read')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async markAsRead(@Param('id') id: string, @GetUser('userId') userId: number) {
    await this.firebaseService.markAsRead(+id, userId);
    return { success: true, message: 'Đã đánh dấu đã đọc' };
  }

  // [NEW] API Đánh dấu tất cả đã đọc
  @Patch('notifications/read-all')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async markAllAsRead(@GetUser('userId') userId: number) {
    await this.firebaseService.markAllAsRead(userId);
    return { success: true, message: 'Đã đánh dấu tất cả là đã đọc' };
  }
}
