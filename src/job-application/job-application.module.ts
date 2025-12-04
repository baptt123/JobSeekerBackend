import { forwardRef, Module } from '@nestjs/common';
import { JobApplicationController } from './job-application.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { JobApplicationsService } from './job-application.service';
import { UserEntity } from '../entity/user.entity';
import { FirebaseModuleModule } from '../firebase-module/firebase-module.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobApplicationEntity,
      JobEntity,
      UserCVEntity,
      UserEntity,
    ]),
    FirebaseModuleModule,
    // BỎ COMMENT DÒNG NÀY
    forwardRef(() => UserModule),
  ],
  controllers: [JobApplicationController],
  providers: [JobApplicationsService],
  exports: [JobApplicationsService],
})
export class JobApplicationModule {}
