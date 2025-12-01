import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from './user.entity';

// [OPTIONAL] Định nghĩa Enum cho loại thông báo để code sạch hơn
export enum NotificationType {
  SYSTEM = 'SYSTEM',
  NEW_JOB = 'NEW_JOB',
  APPLICATION_UPDATE = 'APPLICATION_UPDATE',
  NEW_MESSAGE = 'NEW_MESSAGE',
}

@Entity('notifications')
class NotificationEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty() // Nên thêm để Swagger hiển thị trong response
  notification_id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @ApiProperty({ type: () => UserEntity })
  user: UserEntity;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false, example: 'Hồ sơ của bạn đã được xem' })
  title: string;

  @Column('text', { nullable: true })
  @ApiProperty({
    required: false,
    example: 'Nhà tuyển dụng ABC đã xem hồ sơ...',
  })
  message: string;

  // [THÊM MỚI 1] Loại thông báo
  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.SYSTEM,
  })
  @ApiProperty({ enum: NotificationType, example: NotificationType.SYSTEM })
  type: NotificationType;

  // [THÊM MỚI 2] Dữ liệu đi kèm để điều hướng (quan trọng cho Flutter)
  // Lưu dạng JSON. Ví dụ: { "job_id": 10, "application_id": 5 }
  @Column('json', { nullable: true })
  @ApiProperty({
    required: false,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    type: 'object' as any,
    example: { job_id: 123, click_action: 'JOB_DETAIL' },
  })
  metadata?: Record<string, any>;

  @Column('boolean', { default: false })
  @ApiProperty()
  is_read: boolean;

  @CreateDateColumn()
  @ApiProperty() // Nên thêm để Swagger hiển thị ngày tạo
  created_at: Date;
}

export default NotificationEntity;
