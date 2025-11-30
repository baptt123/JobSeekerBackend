import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
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
  @ApiProperty({ type: () => UserEntity }) // <--- THÊM
  user: UserEntity;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ required: false })
  title: string;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  message: string;

  @Column('boolean', { default: false })
  @ApiProperty()
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}