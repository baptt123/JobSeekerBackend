import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { CompanyEntity } from '../entity/company.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { CommentsModule } from '../comments/comments.module';
import { CommentEntity } from '../entity/comment.entity';
import { CommentService } from '../comments/comments.service';
import { JobService } from '../job/job.service';
import { UserCVEntity } from '../entity/user-cv.entity';
import { SavedJobEntity } from '../entity/save_job.entity';

@Module({
  imports: [
    // <--- 3. Đăng ký các Repository cho Module này
    TypeOrmModule.forFeature([
      UserEntity,
      JobEntity,
      CompanyEntity,
      JobApplicationEntity,
      CommentEntity, // <--- ĐĂNG KÝ REPOSITORY CHO COMMENT
      UserCVEntity,
      SavedJobEntity,
      JobApplicationEntity,
    ]),
    CommentsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, CommentService, JobService],
})
export class AdminModule {}
