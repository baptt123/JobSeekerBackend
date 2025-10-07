import { Module } from '@nestjs/common';
import { MessagesController } from './message.controller';
import { MessagesGateway } from '../socket/message.gateway';
import { MessagesService } from './message.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default_secret', // 👈 nên để trong .env
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway],
})
export class MessageModule {}
