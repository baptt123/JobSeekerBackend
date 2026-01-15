import {
  Injectable,
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

  /**
   * Gửi thông báo Push Notification (Core function)
   * Không catch lỗi 500 ở đây để hàm gọi bên ngoài có thể xử lý logic (ví dụ xóa token)
   */
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

    // Chỉ thực hiện gửi, nếu lỗi sẽ ném ra để sendNotificationToUser xử lý
    const response = await this.getMessaging().send(message);
    this.logger.log(`Thành công gửi thông báo tới token ${token.substring(0, 10)}...`);

    // Nếu gửi thành công và có userId, lưu vào DB (Optional: có thể lưu ở ngoài)
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
  }

  /**
   * Gửi thông báo cho 1 User cụ thể theo User ID
   * Tự động xử lý xóa Token nếu Token không hợp lệ
   */
  async sendNotificationToUser(
    userId: number,
    title: string,
    body: string,
    type: NotificationType = NotificationType.SYSTEM,
    metadata?: Record<string, any>,
  ): Promise<string | null> {
    const userService = this.getUserService();
    if (!userService) return null;

    // 1. Lấy thông tin User và Token
    const user = await userService.userRepo.findOne({
      where: { user_id: userId },
      select: ['user_id', 'fcm_token'],
    });

    // 2. [QUAN TRỌNG] Luôn lưu thông báo vào DB trước hoặc song song
    // Để kể cả khi gửi Push thất bại, User vào app vẫn thấy thông báo
    await this.saveNotificationToDb(userId, title, body, type, metadata);

    // 3. Nếu không có token thì dừng (nhưng đã lưu DB rồi)
    if (!user || !user.fcm_token) {
      this.logger.debug(`User ${userId} không có FCM token. Chỉ lưu xuống DB.`);
      return null;
    }

    try {
      // 4. Cố gắng gửi Push Notification
      return await this.sendPushNotification({
        token: user.fcm_token,
        title,
        body,
        // Không truyền userId vào đây nữa để tránh lưu DB 2 lần (vì đã lưu ở bước 2)
        // Hoặc nếu hàm sendPushNotification logic cũ có check userId để lưu thì bỏ userId ở dòng này
        // userId: userId,
        type,
        data: metadata,
      });
    } catch (error: any) {
      // 5. [FIX LỖI] Xử lý token chết/không hợp lệ
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-argument'
      ) {
        this.logger.warn(`FCM Token của user ${userId} không hợp lệ hoặc đã hết hạn. Đang xóa token...`);

        // Xóa token trong DB để lần sau không gửi lỗi nữa
        // @ts-ignore
        await userService.userRepo.update({ user_id: userId }, { fcm_token: null });
      } else {
        // Log các lỗi khác (ví dụ lỗi mạng, lỗi server Firebase) nhưng không throw 500
        this.logger.error(`Lỗi khi gửi Push cho user ${userId}: ${error.message}`);
      }
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
        `Gửi thông báo thành công topic ${topic}: ${response}`,
      );
      return response;
    } catch (error) {
      this.logger.error(`Lỗi khi gửi thông báo topic ${topic}:`, error);
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
        `Lỗi khi lưu thông báo vào DB cho user ${userId}`,
        error,
      );
    }
  }

  private getUserService(): UserService {
    if (!this.userService) {
      // Dùng ModuleRef để lấy Service nhằm tránh Circular Dependency
      this.userService = this.moduleRef.get(UserService, { strict: false });
    }
    return this.userService;
  }

  // --- CÁC HÀM API CHO CONTROLLER ---

  /**
   * 1. Lấy danh sách thông báo của User
   */
  async getNotifications(userId: number): Promise<NotificationEntity[]> {
    return await this.notificationRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

}