import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn()
  notification_id: number;

  @Column()
  user_id: number;

  @ManyToOne(() => UserEntity, (user) => user.notifications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @Column({ length: 255, nullable: true })
  title: string;

  @Column('text', { nullable: true })
  message: string;

  @Column('boolean', { default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}
