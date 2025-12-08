import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entity/user.entity';
import { JobEntity } from '../entity/job.entity';
import { CompanyEntity } from '../entity/company.entity';
import { JobApplicationEntity } from '../entity/job-application.entity';

@Module({
  imports: [
    // <--- 3. Đăng ký các Repository cho Module này
    TypeOrmModule.forFeature([
      UserEntity,
      JobEntity,
      CompanyEntity,
      JobApplicationEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
