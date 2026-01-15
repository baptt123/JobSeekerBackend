import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';

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
    console.log('>>> API getNotifications CALLED by User ID:', userId);

    try {
      const notifications = await this.firebaseService.getNotifications(userId);

      // Vẫn tính toán số lượng chưa đọc để hiển thị badge nếu cần (tùy chọn)
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

  // [REMOVED] Các API markAsRead và markAllAsRead đã bị loại bỏ theo yêu cầu.
}