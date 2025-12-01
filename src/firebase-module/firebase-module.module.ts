import { forwardRef, Module } from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { FirebaseModuleController } from './firebase-module.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import NotificationEntity from '../entity/notification.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([NotificationEntity]),
    forwardRef(() => UserModule), // <-- 2. Bọc UserModule bằng forwardRef
  ],
  controllers: [FirebaseModuleController],
  providers: [FirebaseModuleService],
  exports: [FirebaseModuleService],
})
export class FirebaseModuleModule {}
