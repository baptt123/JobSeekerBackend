import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationEntity } from '../entity/notification.entity';
import { CreateNotificationDto } from '../dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private notificationRepo: Repository<NotificationEntity>,
  ) {}

  async getUserNotifications(userId: number): Promise<NotificationEntity[]> {
    try {
      const notifications = await this.notificationRepo.find({
        where: { user_id: userId }, // dùng user_id thay vì user: { user_id }
        order: { created_at: 'DESC' },
      });
      if (!notifications || notifications.length === 0) {
        throw new NotFoundException(
          'Không tìm thấy thông báo nào cho người dùng này',
        );
      }
      return notifications;
    } catch (error) {
      throw new InternalServerErrorException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.message ?? 'Lỗi hệ thống khi lấy thông báo',
      );
    }
  }

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<NotificationEntity> {
    try {
      const notification = this.notificationRepo.create({
        ...dto,
        is_read: false,
        created_at: new Date(),
      });
      return await this.notificationRepo.save(notification);
    } catch (error) {
      // Ví dụ lỗi khóa ngoại cho user_id (23503) hoặc các lỗi khác
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === '23503') {
        throw new BadRequestException('Lỗi tham chiếu user_id không hợp lệ');
      }
      throw new InternalServerErrorException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.message ?? 'Lỗi hệ thống khi tạo thông báo',
      );
    }
  }
}
