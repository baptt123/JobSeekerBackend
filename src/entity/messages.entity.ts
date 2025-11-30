import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger'; // <--- IMPORT
import { UserEntity } from './user.entity';

@Entity('messages')
@Index('idx_messages', ['sender_id', 'receiver_id', 'sent_at'])
export class MessageEntity {
  @PrimaryGeneratedColumn()
  message_id: number;

  @Column()
  sender_id: number;

  @ManyToOne(() => UserEntity, (user) => user.sentMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sender_id' })
  @ApiProperty({ type: () => UserEntity }) // <--- THÊM
  sender: UserEntity;

  @Column()
  receiver_id: number;

  @ManyToOne(() => UserEntity, (user) => user.receivedMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receiver_id' })
  @ApiProperty({ type: () => UserEntity }) // <--- THÊM
  receiver: UserEntity;

  @Column('text', { nullable: true })
  @ApiProperty({ required: false })
  content: string;

  @Column('boolean', { default: false })
  @ApiProperty()
  is_read: boolean;

  @CreateDateColumn()
  sent_at: Date;

  @Column({ length: 500, nullable: true })
  @ApiProperty({ required: false })
  image_url: string;

  @Column({
    type: 'enum',
    enum: ['text', 'image'],
    default: 'text',
  })
  @ApiProperty({ enum: ['text', 'image'] })
  message_type: 'text' | 'image';
}