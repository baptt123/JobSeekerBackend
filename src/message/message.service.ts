// src/messages/messages.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { UserEntity } from '../entity/user.entity';
import { SendMessageDto } from '../dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  // send message
  async sendMessage(dto: SendMessageDto) {
    const { sender_id, receiver_id, content } = dto;

    if (sender_id === receiver_id) {
      throw new BadRequestException(
        'sender_id và receiver_id không thể giống nhau',
      );
    }

    // verify users exist
    const [sender, receiver] = await Promise.all([
      this.userRepo.findOne({ where: { user_id: sender_id } }),
      this.userRepo.findOne({ where: { user_id: receiver_id } }),
    ]);

    if (!sender)
      throw new NotFoundException(`Sender user ${sender_id} không tồn tại.`);
    if (!receiver)
      throw new NotFoundException(
        `Receiver user ${receiver_id} không tồn tại.`,
      );

    const message = this.messageRepo.create({
      sender_id,
      receiver_id,
      content,
      // sent_at will be auto set by DB/Entity CreateDateColumn
    });

    return this.messageRepo.save(message);
  }

  // get conversation between two users (ordered by sent_at asc)
  async getConversation(userA: number, userB: number, limit = 50, offset = 0) {
    if (userA === userB)
      throw new BadRequestException('Hai user phải khác nhau');

    // ensure both exist
    const users = await this.userRepo.findByIds([userA, userB]);
    if (users.length < 2)
      throw new NotFoundException('Một trong hai user không tồn tại');

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where(
        '(m.sender_id = :userA AND m.receiver_id = :userB) OR (m.sender_id = :userB AND m.receiver_id = :userA)',
        {
          userA,
          userB,
        },
      )
      .orderBy('m.sent_at', 'ASC')
      .skip(offset)
      .take(limit);

    const [messages, total] = await qb.getManyAndCount();
    return { total, messages };
  }

  // mark single message read (only receiver can mark)
  async markRead(messageId: number, currentUserId: number) {
    const msg = await this.messageRepo.findOne({
      where: { message_id: messageId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.receiver_id !== currentUserId)
      throw new ForbiddenException('Chỉ receiver mới được đánh dấu đã đọc');

    if (msg.is_read) return msg; // nothing to do

    msg.is_read = true;
    return this.messageRepo.save(msg);
  }

  // list last message per conversation for a user (simple inbox list)
  async listConversations(userId: number, limit = 50, offset = 0) {
    // This is a simple implementation: select messages where user is sender or receiver, group by peer -> take latest
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.messageRepo.query(
      `
        SELECT m.*
        FROM messages m
               JOIN (SELECT CASE
                              WHEN sender_id = ? THEN receiver_id
                              ELSE sender_id
                              END        AS peer_id,
                            MAX(sent_at) AS last_sent
                     FROM messages
                     WHERE sender_id = ?
                        OR receiver_id = ?
                     GROUP BY peer_id) t ON
          ((m.sender_id = ? AND m.receiver_id = t.peer_id) OR (m.receiver_id = ? AND m.sender_id = t.peer_id))
            AND m.sent_at = t.last_sent
        ORDER BY m.sent_at DESC LIMIT ?
        OFFSET ?
      `,
      [userId, userId, userId, userId, userId, limit, offset],
    );
  }
}
