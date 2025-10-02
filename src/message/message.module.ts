import { Module } from '@nestjs/common';
import { MessagesController } from './message.controller';
import { MessagesGateway } from '../socket/message.gateway';
import { MessagesService } from './message.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
})
export class MessageModule {}
