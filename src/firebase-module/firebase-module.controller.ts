// src/firebase-module/firebase-module.controller.ts

import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  Req, // ✅ Thêm
} from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';
// Giả định bạn đã có decorator này để lấy user từ req
import { GetUser } from '../decorator/get-user.decorator';

@Controller('firebase') // Route: /api/firebase
export class FirebaseModuleController {
  constructor(private readonly firebaseService: FirebaseModuleService) {}

  /**
   * Endpoint để test gửi push notification
   */
  @Post('send-test')
  @UseGuards(OrAuthGuard)
  @Roles('ADMIN') // ✅ Chỉ nên cho ADMIN test API này
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        message: error.message || 'Failed to send test notification.',
      };
    }
  }

  /**
   * Endpoint để lấy danh sách notifications của user
   */
  @Get('notifications') // ✅ FIX BẢO MẬT: Bỏ :userId để tránh User A xem thông báo của User B
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE', 'ADMIN', 'RECRUITER')
  async getNotifications(
    @GetUser('userId') userId: number, // ✅ Lấy userId từ JWT Payload (an toàn)
  ) {
    // Lưu ý: Nếu không dùng @GetUser, bạn cần dùng @Req() req và lấy req.user.userId
    try {
      const notifications = await this.firebaseService.getNotifications(userId);
      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
        message: error.message || 'Failed to retrieve notifications.',
      };
    }
  }
}
