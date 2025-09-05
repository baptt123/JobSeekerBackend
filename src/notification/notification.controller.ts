import {
  Controller,
  Get,
  Param,
  Body,
  Post,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { map, Observable, Subject } from 'rxjs';
import { CreateNotificationDto } from '../dto/create-notification.dto';

@Controller('notifications')
export class NotificationController {
  private notificationStreams: Record<number, Subject<Notification>> = {};

  constructor(private notificationService: NotificationService) {}

  @Get(':userId')
  async getUserNotifications(
    @Param('userId') userId: number,
  ): Promise<Notification[]> {
    return await this.notificationService.getUserNotifications(userId);
  }

  @Sse(':userId/sse')
  sse(@Param('userId') userId: number): Observable<MessageEvent> {
    if (!this.notificationStreams[userId]) {
      this.notificationStreams[userId] = new Subject<Notification>();
    }
    return this.notificationStreams[userId].pipe(
      map((notif: Notification) => ({
        data: notif,
      })),
    );
  }

  @Post()
  async createNotification(
    @Body() dto: CreateNotificationDto,
  ): Promise<Notification> {
    const notif = await this.notificationService.createNotification(dto);
    if (this.notificationStreams[dto.user_id]) {
      this.notificationStreams[dto.user_id].next(notif);
    }
    return notif;
  }
}
