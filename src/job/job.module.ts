import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from '../entity/job.entity';
import { UserCVEntity } from '../entity/user-cv.entity';
import { SavedJobEntity } from '../entity/save_job.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, UserCVEntity, SavedJobEntity]),
  ],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
