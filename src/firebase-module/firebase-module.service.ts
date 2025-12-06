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
import NotificationEntity, {
  NotificationType,
} from '../entity/notification.entity';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { ModuleRef } from '@nestjs/core';
import { UserService } from '../user/user.service';

@Injectable()
export class FirebaseModuleService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModuleService.name);

  // --- QUAN TRỌNG: Phải khai báo biến này để lưu instance sau khi lazy load ---
  private userService: UserService;
  // --------------------------------------------------------------------------

  constructor(
    private configService: ConfigService,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    // Inject ModuleRef thay vì UserService trực tiếp để tránh Circular Dependency
    private moduleRef: ModuleRef,
  ) {}

  /**
   * Khởi tạo Firebase Admin SDK
   */
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

  /**
   * Helper lấy Messaging service
   */
  getMessaging(): admin.messaging.Messaging {
    return admin.messaging();
  }

  /**
   * Gửi Push Notification (Core function)
   */
  async sendPushNotification(dto: SendNotificationDto): Promise<string> {
    const { token, title, body, userId, data, type } = dto;

    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
      : {};

    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      token: token,
      data: {
        ...stringData,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        type: type ? String(type) : String(NotificationType.SYSTEM),
      },
      android: {
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    try {
      const response = await this.getMessaging().send(message);
      this.logger.log(`Successfully sent FCM message: ${response}`);

      if (userId) {
        await this.saveNotificationToDb(userId, title, body, type, data);
      }

      return response;
    } catch (error) {
      this.logger.error('Error sending FCM message:', error);
      throw new InternalServerErrorException(
        'Failed to send push notification.',
      );
    }
  }

  /**
   * Hàm tiện ích: Gửi thông báo đến User ID
   */
  async sendNotificationToUser(
    userId: number,
    title: string,
    body: string,
    type: NotificationType = NotificationType.SYSTEM,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    // Gọi hàm lazy load để lấy service
    const userService = this.getUserService();

    // Kiểm tra kỹ phòng trường hợp không lấy được service (dù hiếm)
    if (!userService) {
      this.logger.error('UserService not found via ModuleRef');
      return null;
    }

    const user = await userService.userRepo.findOne({
      where: { user_id: userId },
      select: ['user_id', 'fcm_token'],
    });

    if (!user || !user.fcm_token) {
      this.logger.warn(`User ${userId} has no FCM token. Saving to DB only.`);
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
      this.logger.error(`Failed to send notification to user ${userId}`, error);
      await this.saveNotificationToDb(userId, title, body, type, metadata);
      return null;
    }
  }

  /**
   * Lưu thông báo vào Database
   */
  private async saveNotificationToDb(
    userId: number,
    title: string,
    message: string,
    type: NotificationType = NotificationType.SYSTEM,
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
        `Failed to save notification for user ${userId}`,
        error,
      );
    }
  }

  /**
   * Lấy danh sách thông báo của User
   */
  async getNotifications(userId: number): Promise<NotificationEntity[]> {
    return await this.notificationRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' }, // [QUAN TRỌNG] Mới nhất lên đầu
    });
  }

  /**
   * Hàm này lấy UserService một lần khi cần dùng (Lazy Loading)
   * Giúp tránh Circular Dependency tại thời điểm khởi tạo Constructor
   */
  private getUserService(): UserService {
    if (!this.userService) {
      // strict: false cho phép tìm kiếm provider trong context của module khác
      this.userService = this.moduleRef.get(UserService, { strict: false });
    }
    return this.userService;
  }
}
