import { Module } from '@nestjs/common';
import { JobApplicationController } from './job-application.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplicationEntity } from '../entity/job-application.entity';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { JobApplicationsService } from './job-application.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobApplicationEntity, JobEntity, UserCVEntity]),
  ],
  controllers: [JobApplicationController],
  providers: [JobApplicationsService],
  exports: [JobApplicationsService],
})
export class JobApplicationModule {}
