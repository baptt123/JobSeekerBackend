import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApplyJobDto } from '../dto/apply-job.dto';
import { JobApplicationsService } from './job-application.service';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';

@Controller('job-application')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationsService) {}

  @Post('apply')
  @UseGuards(OrAuthGuard) // 1. Bật Guard bảo vệ
  @Roles('CANDIDATE') // 2. Chỉ Ứng viên mới được apply
  @HttpCode(HttpStatus.CREATED)
  async applyForJob(@Req() req: any, @Body() applyJobDto: ApplyJobDto) {
    // 3. Lấy userId thật từ Token
    const userId = req.user.userId;

    // 4. Gọi service
    return this.jobApplicationService.applyForJob(userId, applyJobDto);
  }
}
