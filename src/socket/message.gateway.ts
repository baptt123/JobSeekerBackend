import {
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';
import { MessagesService } from '../message/message.service';
import { CreateMessageDto } from '../dto/create-message.dto';

@WebSocketGateway({ cors: true, path: '/socket.io', namespace: '/chat' })
@Injectable()
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server; // dùng ! để NestJS inject runtime

  private readonly logger = new Logger(MessagesGateway.name);
  // map userId -> set socket.id (1 user có thể nhiều tab/thiết bị)
  private userSockets = new Map<number, Set<string>>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.logger.log('MessagesGateway initialized');
  }

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.query?.token as string;
      if (!token) {
        client.disconnect(true);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(token);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const userId = payload.userId || payload.sub || payload.user_id;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      // Gắn userId vào socket (dùng API chính thức: client.data)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      client.data.userId = userId;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const set = this.userSockets.get(userId) ?? new Set<string>();
      set.add(client.id);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.userSockets.set(userId, set);

      this.logger.log(`User ${userId} connected socket ${client.id}`);
    } catch (err) {
      this.logger.warn('WS auth failed', err);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = client.data.userId as number | undefined;
    if (!userId) return;

    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(client.id);
      if (set.size === 0) this.userSockets.delete(userId);
    }

    this.logger.log(`User ${userId} disconnected socket ${client.id}`);
  }

  private emitToUser(userId: number, event: string, payload: any) {
    const set = this.userSockets.get(userId);
    if (!set) return;
    for (const sockId of set) {
      this.server.to(sockId).emit(event, payload);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @MessageBody() data: CreateMessageDto,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    @ConnectedSocket() _client: Socket,
  ) {
    const saved = await this.messagesService.create(data);

    const payload = {
      message_id: saved.message_id,
      sender_id: saved.sender_id,
      receiver_id: saved.receiver_id,
      content: saved.content,
      is_read: saved.is_read,
      sent_at: saved.sent_at,
    };

    // Emit cho cả sender và receiver
    this.emitToUser(saved.sender_id, 'message', payload);
    this.emitToUser(saved.receiver_id, 'message', payload);

    return { success: true, message: payload };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { to: number },
    @ConnectedSocket() client: Socket,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const from = client.data.userId as number | undefined;
    if (!from) return;

    this.emitToUser(data.to, 'typing', { from });
  }
}
