// src/chat/chat.gateway.ts (hoặc message.gateway.ts)

import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { CreateMessageDto } from '../dto/create-message.dto';
import { MessageService } from './message.service'; // ✅ Import Logger

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('MessageGateway'); // ✅ Khởi tạo Logger
  private connectedUsers: Map<number, Socket> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: MessageService, // Sửa tên service nếu cần
  ) {}

  // 1. Xử lý khi client kết nối (ĐÃ SỬA)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handleConnection(client: Socket, ..._args: any[]) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const token = client.handshake.headers.authorization.split(' ')[1];
      if (!token) {
        return this.disconnect(client, 'Token not found');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'access-secret', // ⚠️ Dùng secret key của bạn
      });

      // ✅✅✅ SỬA LỖI TẠI ĐÂY ✅✅✅
      // Ép kiểu `payload.sub` (thường là string) về `number`
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
      const userId = parseInt(payload.sub, 10);

      if (!userId) {
        return this.disconnect(client, 'Invalid token payload (sub)');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.userId = userId;
      this.connectedUsers.set(userId, client); // Lưu user bằng key KIỂU SỐ

      // ✅ Thêm log để theo dõi
      this.logger.log(
        `Client connected: ${client.id} - User ID: ${userId} (Type: ${typeof userId})`,
      );
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Current connected users: ${[...this.connectedUsers.keys()]}`,
      );

      client.emit('connected', { userId: userId });
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return this.disconnect(client, `Authentication failed: ${e.message}`);
    }
  }

  // 2. Xử lý khi client ngắt kết nối
  handleDisconnect(client: Socket) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = client.data.userId;
    if (userId) {
      this.connectedUsers.delete(userId);
      this.logger.log(`Client disconnected: ${client.id} - User ID: ${userId}`);
      this.logger.log(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Current connected users: ${[...this.connectedUsers.keys()]}`,
      );
    }
  }

  private disconnect(client: Socket, reason: string) {
    this.logger.error(`Disconnecting ${client.id}: ${reason}`);
    client.emit('error', new Error(reason));
    client.disconnect();
  }

  // 3. Sự kiện: Client gửi tin nhắn (ĐÃ THÊM LOG)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateMessageDto,
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const senderId = client.data.userId;
      this.logger.log(
        `Message attempt from User ${senderId} to User ${payload.receiver_id}`,
      );

      const newMessage = await this.chatService.createMessage(
        payload,
        senderId,
      );

      // Tìm socket của người nhận
      const receiverSocket = this.connectedUsers.get(payload.receiver_id);

      if (receiverSocket) {
        // ✅ Nếu tìm thấy, gửi tin nhắn
        this.logger.log(
          `Found receiver socket for ${payload.receiver_id}. Emitting 'receiveMessage'.`,
        );
        receiverSocket.emit('receiveMessage', newMessage);
      } else {
        // ✅ Nếu không tìm thấy, báo log
        this.logger.warn(`Receiver ${payload.receiver_id} is NOT online.`);
        this.logger.warn(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Current connected users: ${[...this.connectedUsers.keys()]}`,
        );
      }

      client.emit('messageSent', newMessage);
    } catch (e) {
      this.logger.error('Failed to send message', e);
      client.emit('error', new Error('Failed to send message'));
    }
  }

  // 4. Sự kiện: Client tải lịch sử hội thoại
  @SubscribeMessage('loadConversation')
  async handleLoadConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { otherUserId: number },
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = client.data.userId;
    this.logger.log(
      `Loading conversation between ${userId} and ${payload.otherUserId}`,
    );
    const messages = await this.chatService.getConversation(
      userId,
      payload.otherUserId,
    );
    client.emit('conversationLoaded', messages);
  }

  // 5. Sự kiện: Client đánh dấu đã đọc
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { senderId: number },
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const receiverId = client.data.userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.chatService.markMessagesAsRead(receiverId, payload.senderId);

    const senderSocket = this.connectedUsers.get(payload.senderId);
    if (senderSocket) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      senderSocket.emit('messagesRead', { receiverId: receiverId });
    }
  }
}
