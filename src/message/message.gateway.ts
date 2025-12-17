// src/message/message.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessageService } from './message.service';
import { Injectable } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
@Injectable()
export class MessageGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private readonly messageService: MessageService) {}

  // 1. KHI USER KẾT NỐI
  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      const id = Number(userId);
      client.join(`user_${id}`); // Join vào room riêng của user đó

      // Cập nhật DB: Online
      await this.messageService.updateUserStatus(id, true);

      // Báo cho mọi người biết user này Online
      this.server.emit('userStatusChanged', { userId: id, is_online: true });
      console.log(`User ${id} connected`);
    }
  }

  // 2. KHI USER NGẮT KẾT NỐI
  async handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId;
    if (userId) {
      const id = Number(userId);

      // Cập nhật DB: Offline + Thời gian out
      await this.messageService.updateUserStatus(id, false);

      // Báo cho mọi người biết
      this.server.emit('userStatusChanged', {
        userId: id,
        is_online: false,
        last_active_at: new Date(),
      });
    }
  }

  // 3. GỬI TIN NHẮN (Text hoặc File URL đã có)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    payload: {
      sender_id: number;
      receiver_id: number;
      content: string;
      type: 'text' | 'image' | 'file';
      file_url?: string;
    },
  ) {
    // Lưu vào DB
    const savedMsg = await this.messageService.saveMessage(payload);

    // Gửi cho người nhận (nếu họ đang online trong room user_ID)
    this.server
      .to(`user_${payload.receiver_id}`)
      .emit('receiveMessage', savedMsg);

    // Gửi lại cho người gửi (để confirm)
    this.server.to(`user_${payload.sender_id}`).emit('messageSent', savedMsg);
  }

  // 4. ĐÁNH DẤU ĐÃ ĐỌC
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() payload: { myId: number; senderId: number },
  ) {
    await this.messageService.markAsRead(payload.myId, payload.senderId);

    // Báo cho người gửi biết tin nhắn đã được xem
    this.server.to(`user_${payload.senderId}`).emit('messageRead', {
      byUserId: payload.myId,
    });
  }
}
