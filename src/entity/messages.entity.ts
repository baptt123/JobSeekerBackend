import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { UserEntity } from './user.entity';

@Entity('Messages')
@Index('idx_messages', ['sender_id', 'receiver_id', 'sent_at'])
export class MessageEntity {
  @PrimaryGeneratedColumn()
  message_id: number;

  @Column()
  sender_id: number;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ManyToOne(() => UserEntity, (user) => user.sentMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sender_id' })
  sender: UserEntity;

  @Column()
  receiver_id: number;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  @ManyToOne(() => UserEntity, (user) => user.receivedMessages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receiver_id' })
  receiver: UserEntity;

  @Column('text')
  content: string;

  @Column('boolean', { default: false })
  is_read: boolean;

  @CreateDateColumn()
  sent_at: Date;
}
