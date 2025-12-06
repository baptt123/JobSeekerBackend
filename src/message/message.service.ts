// src/message/message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { CreateMessageDto } from '../dto/create-message.dto';
import { UserEntity } from '../entity/user.entity'; //

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async createMessage(
    createMessageDto: CreateMessageDto,
    senderId: number,
  ): Promise<MessageEntity> {
    const newMessage = this.messageRepository.create({
      sender_id: senderId,
      receiver_id: createMessageDto.receiver_id,
      content: createMessageDto.content,
      image_url: createMessageDto.image_url,
      message_type: createMessageDto.message_type,
      sent_at: new Date(),
    });
    return this.messageRepository.save(newMessage);
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

  // [MỚI] Lấy danh sách người dùng đã từng chat
  async getChatPartners(currentUserId: number): Promise<UserEntity[]> {
    // 1. Lấy danh sách ID người đã gửi tin nhắn cho mình
    const senders = await this.messageRepository
      .createQueryBuilder('msg')
      .select('msg.sender_id')
      .where('msg.receiver_id = :id', { id: currentUserId })
      .distinct(true)
      .getRawMany();

    // 2. Lấy danh sách ID người mình đã gửi tin nhắn tới
    const receivers = await this.messageRepository
      .createQueryBuilder('msg')
      .select('msg.receiver_id')
      .where('msg.sender_id = :id', { id: currentUserId })
      .distinct(true)
      .getRawMany();

    // 3. Gộp lại thành một Set các ID duy nhất
    const partnerIds = new Set<number>();
    senders.forEach((s) => partnerIds.add(s.sender_id));
    receivers.forEach((r) => partnerIds.add(r.receiver_id));

    if (partnerIds.size === 0) {
      return [];
    }

    // 4. Lấy thông tin User chi tiết từ danh sách ID
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.user_id IN (:...ids)', { ids: Array.from(partnerIds) })
      .select([
        'user.user_id',
        'user.email',
        'user.full_name',
        'user.avatar_url',
        // Thêm các trường khác nếu cần
      ])
      .getMany();
  }
}
