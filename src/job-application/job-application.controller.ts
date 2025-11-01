import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { ApplyJobDto } from '../dto/apply-job.dto';
import { JobApplicationsService } from './job-application.service';

@Controller('job-application')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationsService) {}

  // @UseGuards(JwtAuthGuard)
  @Post('apply')
  async applyForJob(@Body() applyJobDto: ApplyJobDto) {
    // req.user.userId được lấy từ JWT payload sau khi qua JwtAuthGuard
    // const userId = req.user.userId;
    return this.jobApplicationService.applyForJob(1, applyJobDto.jobId);
  }
}
