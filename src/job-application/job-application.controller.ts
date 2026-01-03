import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Patch,
  Param,
  ParseIntPipe, // Import ValidationPipe
} from '@nestjs/common';
import { ApplyJobDto } from '../dto/apply-job.dto';
import { JobApplicationsService } from './job-application.service';
import { OrAuthGuard } from '../guard/or-auth.guard';
import { Roles } from '../decorator/role.decorator';

@Controller('job-application')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationsService) {}

  @Post('apply')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE')
  @HttpCode(HttpStatus.CREATED)
  async applyForJob(
    @Req() req: any,
    // Thêm ValidationPipe để đảm bảo dữ liệu đầu vào chuẩn
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    applyJobDto: ApplyJobDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.jobApplicationService.applyForJob(userId, applyJobDto);
  }
// [NEW] API Hủy ứng tuyển
  @Patch('cancel/:jobId')
  @UseGuards(OrAuthGuard)
  @Roles('CANDIDATE') // Chỉ ứng viên mới được hủy
  async cancelApplication(
    @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: any,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.jobApplicationService.cancelJobApplication(userId, jobId);
  }
}
