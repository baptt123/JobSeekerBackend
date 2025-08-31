import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { ChatGateway } from '../socket/socket.gateway';

@Module({
  controllers: [MessageController],
  providers: [MessageService, ChatGateway],
})
export class MessageModule {}
