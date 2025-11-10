// src/firebase-module/firebase-module.controller.ts

import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  Get,
  Param,
  ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { FirebaseAuthGuard } from '../guard/firebase-auth.guard';
// import { JwtAuthGuard } from '../guard/jwt-auth.guard'; // <-- Ví dụ: bảo vệ API

@Controller('firebase') // Route: /api/firebase
export class FirebaseModuleController {
  constructor(private readonly firebaseService: FirebaseModuleService) {}

  /**
   * Endpoint để test gửi push notification
   */
  // @UseGuards(FirebaseAuthGuard)
  @Post('send-test')
  // @UseGuards(JwtAuthGuard) // Nên bảo vệ endpoint này
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
  @Get('notifications/:userId')
  // @UseGuards(JwtAuthGuard) // Nên bảo vệ endpoint này
  async getNotificationsByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    // Lưu ý: Trong thực tế, bạn nên lấy userId từ (req.user) đã được xác thực
    // thay vì tin tưởng vào Param, để tránh user này xem thông báo của user khác.
    // Tuy nhiên, để test thì cách này vẫn hoạt động.
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
