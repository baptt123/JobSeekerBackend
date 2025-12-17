import { Module } from '@nestjs/common';
import { RecruiterService } from './recruiter.service';
import { RecruiterController } from './recruiter.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { CompanyEntity } from '../entity/company.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { SkillEntity } from '../entity/skill.entity';
import { JobSkillEntity } from '../entity/job-skill.entity';
import { FirebaseModuleModule } from '../firebase-module/firebase-module.module';
import { UserCVEntity } from '../entity/user-cv.entity';
import { CommentsModule } from '../comments/comments.module';
import { CommentService } from '../comments/comments.service';
import { CommentEntity } from '../entity/comment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobEntity,
      UserEntity,
      SkillEntity,
      JobSkillEntity,
      JobApplicationEntity, // <--- Đăng ký Repository
      CompanyEntity,
      UserCVEntity,
      CommentEntity,
    ]),
    FirebaseModuleModule, // Để dùng Notification Service
    CommentsModule,
  ],
  controllers: [RecruiterController],
  providers: [RecruiterService, CommentService],
})
export class RecruiterModule {}
