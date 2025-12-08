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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      JobEntity,
      CompanyEntity,
      JobApplicationEntity,
      SkillEntity,
      JobSkillEntity,
    ]),
    FirebaseModuleModule, // Để dùng Notification Service
  ],
  controllers: [RecruiterController],
  providers: [RecruiterService],
})
export class RecruiterModule {}
