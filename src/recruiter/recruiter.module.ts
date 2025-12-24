// src/recruiter/recruiter.module.ts
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
import { NotificationEntity } from '../entity/notification.entity'; // ✅ Sửa lại import có { }
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobEntity,
      UserEntity,
      SkillEntity,
      JobSkillEntity,
      JobApplicationEntity,
      CompanyEntity,
      UserCVEntity,
      // CommentEntity, // ❌ Xóa dòng này, để CommentsModule quản lý Entity của nó
      NotificationEntity,
    ]),
    FirebaseModuleModule,
    CommentsModule, // ✅ Module này đã export CommentService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET') || 'secret', // Đồng bộ với AuthService
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RecruiterController],
  providers: [
    RecruiterService,
    // ❌ Xóa CommentService ở đây
  ],
})
export class RecruiterModule {}