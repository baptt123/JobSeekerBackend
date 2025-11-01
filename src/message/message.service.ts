// src/chat/message.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { CreateMessageDto } from '../dto/create-message.dto';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepository: Repository<MessageEntity>,
  ) {}

  async createMessage(
    createMessageDto: CreateMessageDto,
    senderId: number,
  ): Promise<MessageEntity> {
    // ✅ TẠO TIN NHẮN VỚI CÁC TRƯỜNG MỚI
    const newMessage = this.messageRepository.create({
      sender_id: senderId,
      receiver_id: createMessageDto.receiver_id,
      content: createMessageDto.content, // Sẽ là null/undefined nếu là ảnh
      image_url: createMessageDto.image_url, // Sẽ là link nếu là ảnh
      message_type: createMessageDto.message_type,
      sent_at: new Date(),
    });
    return this.messageRepository.save(newMessage);
  }

  // ... (getConversation và markMessagesAsRead không đổi)
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
}