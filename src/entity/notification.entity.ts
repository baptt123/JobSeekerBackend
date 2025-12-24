// src/entity/notification.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum NotificationType {
  SYSTEM = 'SYSTEM',
  NEW_JOB = 'NEW_JOB',
  APPLICATION_UPDATE = 'APPLICATION_UPDATE',
  NEW_MESSAGE = 'NEW_MESSAGE',
}

@Entity('notifications')
export class NotificationEntity { // 🔥 Đổi thành Named Export
  @PrimaryGeneratedColumn()
  notification_id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ length: 255, nullable: true })
  title: string;

  @Column('text', { nullable: true })
  message: string;

  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.SYSTEM })
  type: NotificationType;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @Column('boolean', { default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}