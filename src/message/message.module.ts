import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageEntity } from '../entity/messages.entity';
import { UserEntity } from '../entity/user.entity';
import { AuthModule } from '../auth/auth.module';
import { MessageController } from './message.controller';
import { FirebaseModuleModule } from '../firebase-module/firebase-module.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, UserEntity]), // ✅ Đăng ký MessageEntity
    AuthModule, // ✅ Import AuthModule để dùng JwtService
    FirebaseModuleModule, // [MỚI] Import module này
  ],
  controllers: [MessageController],
  providers: [MessageGateway, MessageService],
  exports: [MessageService],
})
export class MessageModule {}
