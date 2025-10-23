// src/messages/messages.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BadRequestException, Logger } from '@nestjs/common';
import { MessagesService } from './message.service';
import { SendMessageDto } from '../dto/send-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*', // Cho phép test Postman hoặc localhost
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MessagesGateway');

  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Khi client join vào room user_id (dùng sau khi đăng nhập)
   * client.emit('join', { userId: 1 })
   */
  @SubscribeMessage('join')
  async handleJoin(
    @MessageBody() data: { userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.userId) throw new BadRequestException('userId required');
    const room = `user_${data.userId}`;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    client.emit('joined', { room });
  }

  /**
   * Khi client gửi tin nhắn realtime
   * event: send_message
   * payload: { sender_id, receiver_id, content }
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const saved = await this.messagesService.sendMessage(dto);

      // Gửi lại cho chính người gửi
      this.server.to(`user_${dto.sender_id}`).emit('message_sent', saved);

      // Broadcast tới người nhận (room user_receiver_id)
      this.server.to(`user_${dto.receiver_id}`).emit('new_message', saved);

      return { success: true, message: saved };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      client.emit('error', { error: err.message });
      throw err;
    }
  }
}
