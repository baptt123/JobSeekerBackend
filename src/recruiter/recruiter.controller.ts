import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Render,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { Roles } from '../decorator/role.decorator';
import { RecruiterService } from './recruiter.service';
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { WebAuthGuard } from '../guard/web-auth.guard';

@Controller('recruiter')
@UseGuards(WebAuthGuard) // <--- Áp dụng Guard Web
@Roles('RECRUITER', 'ADMIN') // Admin cũng có thể test chức năng của Recruiter
export class RecruiterController {
  constructor(private readonly service: RecruiterService) {}

  @Get('dashboard')
  @Render('recruiter/dashboard')
  async getDashboard(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const data = await this.service.getRecruiterStats(userId);
    const chartData = await this.service.getRecruiterChartData(userId);

    return {
      company: data.company,
      stats: data.stats,
      chartData: JSON.stringify(chartData),
    };
  }

  @Post('jobs')
  async createJob(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true })) dto: RecruiterCreateJobDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.service.createJob(req.user.userId, dto);
  }

// [SỬA ĐỔI] Thay vì trả về JSON array, ta Render view
  @Get('my-jobs')
  @Render('recruiter/my-jobs') // <--- Quan trọng: Trỏ tới file view
  async getMyJobs(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const jobs = await this.service.getMyJobs(userId);

    // Trả về object chứa data cho Handlebars
    return {
      jobs: jobs,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      user: req.user // Truyền thêm user info nếu cần hiển thị tên
    };
  }
  @Get('jobs/:jobId/applications')
  async getJobApplications(@Req() req: any, @Param('jobId') jobId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
    return this.service.getJobApplications(req.user.userId, +jobId);
  }

  @Patch('applications/:id/status')
  async updateApplicationStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: UpdateApplicationStatusDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
    return this.service.updateApplicationStatus(req.user.userId, +id, dto);
  }
  @Get('jobs/:id')
  @Render('recruiter/job-detail') // Trỏ tới file view mới
  async getJobDetail(@Req() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const jobId = +id;

    // 1. Lấy danh sách Job để check quyền sở hữu (hoặc viết hàm check riêng cho tối ưu)
    const myJobs = await this.service.getMyJobs(userId);
    const job = myJobs.find((j) => j.job_id === jobId);

    if (!job) {
      throw new NotFoundException(
        'Job không tồn tại hoặc bạn không có quyền truy cập',
      );
    }

    // 2. Lấy danh sách ứng viên của Job này
    const applications = await this.service.getJobApplications(userId, jobId);

    return {
      job, // Thông tin Job (Title, Salary...)
      applications, // Danh sách người ứng tuyển
    };
  }
  @Get('chat')
  @Render('recruiter/chat') // Sẽ trỏ tới file views/recruiter/chat.hbs
  getChatPage(@Req() req: any) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      user: req.user, // Truyền thông tin user xuống view để lấy token/id
    };
  }
  // 1. Hiển thị Form tạo Job
  @Get('post-job')
  @Render('recruiter/post-job')
  getPostJobPage() {
    return {}; // Render view views/recruiter/post-job.hbs
  }
}
