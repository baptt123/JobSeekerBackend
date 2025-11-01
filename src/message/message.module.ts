import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { AuthService } from '../auth/auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { UserEntity } from '../entity/user.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, UserEntity]), // ✅ Đăng ký MessageEntity
    AuthModule, // ✅ Import AuthModule để dùng JwtService
  ],
  providers: [MessageGateway, MessageService],
  exports: [MessageService],
})
export class MessageModule {}
