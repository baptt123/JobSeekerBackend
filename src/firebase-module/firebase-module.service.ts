import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationEntity,
  NotificationType,
} from '../entity/notification.entity';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { ModuleRef } from '@nestjs/core';
import { UserService } from '../user/user.service';

@Injectable()
export class FirebaseModuleService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModuleService.name);
  private userService: UserService;

  constructor(
    private configService: ConfigService,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private moduleRef: ModuleRef,
  ) {}

  // ... (Các hàm init, sendPushNotification, sendNotificationToUser, sendNotificationToTopic giữ nguyên)

  onModuleInit() {
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!privateKey || !projectId || !clientEmail) {
      this.logger.warn(
        'Firebase config missing. Push notifications will not work.',
      );
      return;
    }

    const firebaseConfig = {
      projectId: projectId,
      privateKey: privateKey.replace(/\\n/g, '\n').replace(/\r/g, ''),
      clientEmail: clientEmail,
    };

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
      });
      this.logger.log('Firebase Admin initialized successfully.');
    }
  }

  getMessaging(): admin.messaging.Messaging {
    return admin.messaging();
  }

  async sendPushNotification(dto: SendNotificationDto): Promise<string> {
    const { token, title, body, userId, data, type } = dto;

    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : {};

    const message: admin.messaging.Message = {
      notification: { title, body },
      token: token,
      data: {
        ...stringData,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: type ? String(type) : String(NotificationType.SYSTEM),
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    try {
      const response = await this.getMessaging().send(message);
      this.logger.log(`Thành công gửi thông báo: ${response}`);

      if (userId) {
        await this.saveNotificationToDb(
          userId,
          title,
          body,
          type ?? NotificationType.SYSTEM,
          data,
        );
      }
      return response;
    } catch (error) {
      this.logger.error('Lỗi khi gửi thông báo:', error);
      throw new InternalServerErrorException(
        'Lỗi gửi thông báo.',
      );
    }
  }

  async sendNotificationToUser(
    userId: number,
    title: string,
    body: string,
    type: NotificationType = NotificationType.SYSTEM,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    const userService = this.getUserService();
    if (!userService) return null;

    const user = await userService.userRepo.findOne({
      where: { user_id: userId },
      select: ['user_id', 'fcm_token'],
    });

    if (!user || !user.fcm_token) {
      this.logger.warn(`User ${userId} không có FCM token. Chỉ lưu xuống DB.`);
      await this.saveNotificationToDb(userId, title, body, type, metadata);
      return null;
    }

    try {
      return await this.sendPushNotification({
        token: user.fcm_token,
        title,
        body,
        userId,
        type,
        data: metadata,
      });
    } catch (error) {
      this.logger.error(`Lỗi khi gửi thông báo ${userId}`, error);
      await this.saveNotificationToDb(userId, title, body, type, metadata);
      return null;
    }
  }

  async sendNotificationToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<string | null> {
    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : {};

    const message: admin.messaging.Message = {
      notification: { title, body },
      topic: topic,
      data: {
        ...stringData,
        type: String(NotificationType.NEW_JOB),
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    try {
      const response = await this.getMessaging().send(message);
      this.logger.log(
        `Gửi thông báo thành công  ${topic}: ${response}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Lỗi khi gửi thông báo ${topic}:`, error);
      return null;
    }
  }

  private async saveNotificationToDb(
    userId: number,
    title: string,
    message: string,
    type: NotificationType,
    metadata?: Record<string, any>,
  ) {
    try {
      const newNotification = this.notificationRepository.create({
        user_id: userId,
        title,
        message,
        is_read: false,
        type,
        metadata,
      });
      await this.notificationRepository.save(newNotification);
    } catch (error) {
      this.logger.error(
        `Lỗi khi lưu thông báo: ${userId}`,
        error,
      );
    }
  }

  private getUserService(): UserService {
    if (!this.userService) {
      this.userService = this.moduleRef.get(UserService, { strict: false });
    }
    return this.userService;
  }

  // --- [NEW] CÁC HÀM BỔ SUNG ĐỂ CONTROLLER GỌI ---

  /**
   * 1. Lấy danh sách thông báo của User
   */
  async getNotifications(userId: number): Promise<NotificationEntity[]> {
    return await this.notificationRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * 2. Đánh dấu 1 thông báo là đã đọc
   */
  async markAsRead(notificationId: number, userId: number): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { notification_id: notificationId, user_id: userId },
    });

    if (notification) {
      notification.is_read = true;
      await this.notificationRepository.save(notification);
    }
  }

  /**
   * 3. Đánh dấu tất cả thông báo là đã đọc
   */
  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );
  }
}
