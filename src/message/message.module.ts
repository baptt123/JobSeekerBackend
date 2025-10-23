import { Module } from '@nestjs/common';
import { MessagesController } from './message.controller';
import { MessagesGateway } from './message.gateway';
import { MessagesService } from './message.service';
import { MessageEntity } from '../entity/messages.entity';
import { UserEntity } from '../entity/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([MessageEntity, UserEntity]), UserModule],
  providers: [MessagesGateway, MessagesService],
  exports: [MessagesService],
  controllers: [MessagesController],
})
export class MessageModule {}
