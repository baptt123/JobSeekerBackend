import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { CreateMessageDto } from '../dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
  ) {}

  async create(dto: CreateMessageDto): Promise<MessageEntity> {
    const message = this.messageRepo.create({
      sender_id: dto.sender_id,
      receiver_id: dto.receiver_id,
      content: dto.content,
    });
    return this.messageRepo.save(message);
  }

  async findConversation(
    userA: number,
    userB: number,
    limit = 100,
    offset = 0,
  ) {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where(
        '(m.sender_id = :a AND m.receiver_id = :b) OR (m.sender_id = :b AND m.receiver_id = :a)',
        { a: userA, b: userB },
      )
      .orderBy('m.sent_at', 'ASC')
      .skip(offset)
      .take(limit);

    return qb.getMany();
  }

  async markAsRead(receiverId: number, senderId: number) {
    await this.messageRepo
      .createQueryBuilder()
      .update(MessageEntity)
      .set({ is_read: true })
      .where(
        'receiver_id = :receiverId AND sender_id = :senderId AND is_read = false',
        { receiverId, senderId },
      )
      .execute();
  }

  async getUnreadCount(userId: number) {
    return this.messageRepo.count({
      where: { receiver_id: userId, is_read: false },
    });
  }

  async findById(id: number) {
    const m = await this.messageRepo.findOne({ where: { message_id: id } });
    if (!m) throw new NotFoundException('Message not found');
    return m;
  }
}
