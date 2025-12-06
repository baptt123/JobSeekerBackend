import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  UseGuards,
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
        message: 'Test notification sent successfully.',
        messageId: messageId,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to send test notification.',
      };
    }
  }

  // [UPDATE] API Lấy danh sách thông báo theo User đăng nhập
  @Get('notifications')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async getNotifications(
    @GetUser('userId') userId: number, // Lấy ID từ Token
  ) {
    try {
      const notifications = await this.firebaseService.getNotifications(userId);
      // Đếm số lượng chưa đọc để hiển thị badge
      const unreadCount = notifications.filter((n) => !n.is_read).length;

      return {
        success: true,
        data: notifications,
        unreadCount: unreadCount, // Trả thêm số lượng chưa đọc
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to retrieve notifications.',
      };
    }
  }
}