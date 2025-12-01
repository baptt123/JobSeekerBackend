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
import NotificationEntity from '../entity/notification.entity';
import { SendNotificationDto } from '../dto/send-notification.dto';
import { UserService } from '../user/user.service';

// Interface cho payload (từ code của bạn)
export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
}

@Injectable()
export class FirebaseModuleService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseModuleService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private readonly userService: UserService,
  ) {}

  /**
   * Khởi tạo Firebase Admin khi module được load
   */
  onModuleInit() {
    // Lấy thông tin config từ biến môi trường
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!privateKey || !projectId || !clientEmail) {
      throw new InternalServerErrorException(
        'Firebase config (PRIVATE_KEY, PROJECT_ID, CLIENT_EMAIL) không được tìm thấy trong biến môi trường.',
      );
    }

    // Thay thế ký tự '\n' (dạng chuỗi) bằng ký tự xuống dòng thật
    const firebaseConfig = {
      projectId: projectId,
      privateKey: privateKey.replace(/\\n/g, '\n').replace(/\r/g, ''),
      clientEmail: clientEmail,
    };

    // Khởi tạo app
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig),
      });
      this.logger.log("'Firebase Config:'", firebaseConfig);
      this.logger.log('Firebase Admin đã được khởi tạo thành công.');
    }
  }

  /**
   * Lấy dịch vụ Authentication của Firebase
   */
  getAuth(): admin.auth.Auth {
    return admin.auth();
  }

  /**
   * Lấy dịch vụ Messaging của Firebase
   */
  getMessaging(): admin.messaging.Messaging {
    return admin.messaging();
  }

  /**
   * Gửi Push Notification đến một thiết bị cụ thể qua FCM token
   */
  async sendPushNotification(dto: SendNotificationDto): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    const { token, title, body, userId, data } = dto;

    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      token: token,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: {
        ...data, // Gộp data tùy chỉnh nếu có
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
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
      // Sử dụng getMessaging() để gửi
      const response = await this.getMessaging().send(message);
      this.logger.log(`Successfully sent message: ${response}`);

      // (Tùy chọn) Lưu thông báo này vào CSDL
      if (userId) {
        await this.saveNotificationToDb(userId, title, body);
      }

      return response; // Trả về Message ID
    } catch (error) {
      this.logger.error('Error sending FCM message:', error);
      throw new InternalServerErrorException(
        'Failed to send push notification.',
      );
    }
  }

  /**
   [cite_start]* [cite: 44]
   * Lưu thông báo vào bảng NotificationEntity
   */
  private async saveNotificationToDb(
    userId: number,
    title: string,
    message: string,
  ) {
    try {
      const newNotification = this.notificationRepository.create({
        user_id: userId, // [cite: 45]
        title: title, // [cite: 46]
        message: message, // [cite: 46]
        is_read: false, // [cite: 47]
      });
      await this.notificationRepository.save(newNotification);
      this.logger.log(`Notification saved to DB for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to save notification to DB for user ${userId}:`,
        error,
      );
    }
  }
  /**
   * Lấy danh sách thông báo từ CSDL cho một user
   */
  async getNotifications(userId: number): Promise<NotificationEntity[]> {
    try {
      return await this.notificationRepository.find({
        where: { user_id: userId },
        order: { created_at: 'DESC' }, // Sắp xếp mới nhất lên đầu
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch notifications for user ${userId}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Could not retrieve notifications.',
      );
    }
  }
}
