import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { MessageGateway } from './message.gateway';
import { MessageEntity } from '../entity/messages.entity';
import { UserEntity } from '../entity/user.entity';
import { CloudinaryCustomModule } from '../cloudinary-custom/cloudinary-custom.module';
import { FirebaseModuleModule } from '../firebase-module/firebase-module.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageEntity, UserEntity]),
    CloudinaryCustomModule,
    FirebaseModuleModule, // [2] Thêm vào đây để MessageService dùng được FirebaseService
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
