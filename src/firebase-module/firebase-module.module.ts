import { Module } from '@nestjs/common';
import { FirebaseModuleService } from './firebase-module.service';
import { FirebaseModuleController } from './firebase-module.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from '../entity/notification.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { UserEntity } from '../entity/user.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      NotificationEntity,
      JobApplicationEntity,
      JobEntity,
      UserCVEntity,
      UserEntity,
    ]),
    // forwardRef(() => UserModule), // <-- 2. Bọc UserModule bằng forwardRef
  ],
  controllers: [FirebaseModuleController],
  providers: [FirebaseModuleService],
  exports: [FirebaseModuleService],
})
export class FirebaseModuleModule {}
