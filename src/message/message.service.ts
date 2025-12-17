import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { UserEntity } from '../entity/user.entity';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service'; // [IMPORT]
import { NotificationType } from '../entity/notification.entity';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly firebaseService: FirebaseModuleService, // [INJECT]
  ) {}

  // 1. [ĐÃ ĐIỀU CHỈNH] Lưu tin nhắn & Gửi Notification
  async saveMessage(data: {
    sender_id: number;
    receiver_id: number;
    content: string;
    type: string;
    file_url?: string;
  }) {
    // A. Lưu vào DB
    const msg = this.messageRepo.create({
      sender_id: data.sender_id,
      receiver_id: data.receiver_id,
      content: data.content,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      message_type: data.type as any,
      image_url: data.file_url,
      sent_at: new Date(),
      is_read: false,
    });
    const savedMsg = await this.messageRepo.save(msg);

    // B. Gửi Firebase Notification (Nếu user đang login - có token)
    await this.firebaseService.sendNotificationToUser(
      data.receiver_id,
      'Tin nhắn mới',
      data.content,
      NotificationType.SYSTEM, // Hoặc loại CHAT
      {
        type: 'CHAT_MSG',
        senderId: data.sender_id.toString(),
        messageId: savedMsg.message_id.toString(),
      },
    );

    return savedMsg;
  }

  // 2. Lấy danh sách hội thoại
  async getConversations(userId: number) {
    const subQuery = this.messageRepo
      .createQueryBuilder('m')
      .select('MAX(m.message_id)', 'max_id')
      .where('m.sender_id = :userId OR m.receiver_id = :userId', { userId })
      .groupBy(
        'CASE WHEN m.sender_id = :userId THEN m.receiver_id ELSE m.sender_id END',
      );

    const messages = await this.messageRepo
      .createQueryBuilder('msg')
      .innerJoin(
        `(${subQuery.getQuery()})`,
        'sub',
        'msg.message_id = sub.max_id',
      )
      .setParameters(subQuery.getParameters())
      .leftJoinAndSelect('msg.sender', 'sender')
      .leftJoinAndSelect('msg.receiver', 'receiver')
      .orderBy('msg.sent_at', 'DESC')
      .getMany();

    const conversations = await Promise.all(
      messages.map(async (msg) => {
        const partner = msg.sender_id === userId ? msg.receiver : msg.sender;

        const unreadCount = await this.messageRepo.count({
          where: {
            sender_id: partner.user_id,
            receiver_id: userId,
            is_read: false,
          },
        });

        return {
          partner_id: partner.user_id,
          full_name: partner.full_name,
          avatar_url: partner.avatar_url,
          is_online: partner.is_online,
          last_active_at: partner.last_active_at,
          last_message: {
            content: msg.content,
            type: msg.message_type,
            created_at: msg.sent_at,
            is_read: msg.is_read,
            is_me: msg.sender_id === userId,
          },
          unread_count: unreadCount,
        };
      }),
    );

    return conversations;
  }

  // 3. Lấy chi tiết lịch sử chat
  async getMessages(user1: number, user2: number) {
    return await this.messageRepo
      .createQueryBuilder('msg')
      .where(
        '(msg.sender_id = :u1 AND msg.receiver_id = :u2) OR (msg.sender_id = :u2 AND msg.receiver_id = :u1)',
        { u1: user1, u2: user2 },
      )
      .orderBy('msg.sent_at', 'ASC')
      .getMany();
  }

  // 4. Cập nhật trạng thái User
  async updateUserStatus(userId: number, isOnline: boolean) {
    await this.userRepo.update(userId, {
      is_online: isOnline,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment
      last_active_at: (isOnline ? null : new Date()) as any,
    });
  }

  // 5. Đánh dấu đã đọc
  async markAsRead(myId: number, senderId: number) {
    await this.messageRepo.update(
      { sender_id: senderId, receiver_id: myId, is_read: false },
      { is_read: true },
    );
  }
}