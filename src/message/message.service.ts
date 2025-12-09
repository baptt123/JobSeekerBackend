// src/message/message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UserEntity } from '../entity/user.entity';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service'; // [MỚI]
import { NotificationType } from '../entity/notification.entity'; // [MỚI]

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    // [MỚI] Inject Service thông báo
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  async createMessage(
    createMessageDto: CreateMessageDto,
    senderId: number,
  ): Promise<MessageEntity> {
    // 1. Lưu tin nhắn vào DB
    const newMessage = this.messageRepository.create({
      sender_id: senderId,
      receiver_id: createMessageDto.receiver_id,
      content: createMessageDto.content,
      image_url: createMessageDto.image_url,
      message_type: createMessageDto.message_type,
      sent_at: new Date(),
    });
    const savedMessage = await this.messageRepository.save(newMessage);

    // 2. [MỚI] Gửi thông báo Push Notification (Chạy ngầm)
    this.sendChatNotification(senderId, createMessageDto).catch((err) =>
      console.error('Lỗi gửi thông báo chat:', err),
    );

    return savedMessage;
  }

  // [MỚI] Hàm phụ để gửi thông báo
  private async sendChatNotification(senderId: number, dto: CreateMessageDto) {
    // Lấy thông tin người gửi để hiển thị tên trong thông báo
    const sender = await this.userRepository.findOne({
      where: { user_id: senderId },
      select: ['full_name', 'avatar_url', 'user_id'],
    });

    if (!sender) return;

    // Xác định nội dung hiển thị
    let body = dto.content;
    if (dto.message_type === 'image') body = '📷 Đã gửi một ảnh';
    else if (dto.message_type === 'file') body = '📁 Đã gửi một tệp tin';
    else if (dto.message_type === 'sticker') body = 'Đã gửi một nhãn dán';

    // Gửi thông báo
    await this.firebaseService.sendNotificationToUser(
      dto.receiver_id,
      `Tin nhắn mới từ ${sender.full_name}`, // Tiêu đề
      body || 'Bạn có tin nhắn mới', // Nội dung
      NotificationType.NEW_MESSAGE, // Loại thông báo
      {
        click_action: 'CHAT_DETAIL',
        // Truyền các thông tin cần thiết để Flutter mở màn hình chat
        other_user_id: sender.user_id,
        other_user_name: sender.full_name,
        other_user_avatar: sender.avatar_url || '',
      },
    );
  }

  async getConversation(
    userId1: number,
    userId2: number,
  ): Promise<MessageEntity[]> {
    return this.messageRepository
      .createQueryBuilder('message')
      .where(
        '(message.sender_id = :userId1 AND message.receiver_id = :userId2) OR (message.sender_id = :userId2 AND message.receiver_id = :userId1)',
        { userId1, userId2 },
      )
      .orderBy('message.sent_at', 'ASC')
      .getMany();
  }

  async markMessagesAsRead(
    receiverId: number,
    senderId: number,
  ): Promise<void> {
    await this.messageRepository.update(
      {
        receiver_id: receiverId,
        sender_id: senderId,
        is_read: false,
      },
      { is_read: true },
    );
  }

  async getChatPartners(currentUserId: number): Promise<UserEntity[]> {
    const senders = await this.messageRepository
      .createQueryBuilder('msg')
      .select('msg.sender_id')
      .where('msg.receiver_id = :id', { id: currentUserId })
      .distinct(true)
      .getRawMany();

    const receivers = await this.messageRepository
      .createQueryBuilder('msg')
      .select('msg.receiver_id')
      .where('msg.sender_id = :id', { id: currentUserId })
      .distinct(true)
      .getRawMany();

    const partnerIds = new Set<number>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    senders.forEach((s) => partnerIds.add(s.sender_id));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    receivers.forEach((r) => partnerIds.add(r.receiver_id));

    if (partnerIds.size === 0) {
      return [];
    }

    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.user_id IN (:...ids)', { ids: Array.from(partnerIds) })
      .select([
        'user.user_id',
        'user.email',
        'user.full_name',
        'user.avatar_url',
      ])
      .getMany();
  }
}
