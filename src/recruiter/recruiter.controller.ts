import {
  Body,
  Controller,
  Delete,
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
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';
import { CommentService } from '../comments/comments.service';
import { FirebaseModuleService } from '../firebase-module/firebase-module.service';

@Controller('recruiter')
@UseGuards(WebAuthGuard)
@Roles('RECRUITER', 'ADMIN')
export class RecruiterController {
  constructor(
    private readonly service: RecruiterService,
    private readonly commentService: CommentService,
    private readonly firebaseService: FirebaseModuleService,
  ) {}

  @Get('dashboard')
  @Render('recruiter/dashboard')
  async getDashboard(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
    const userId = req.user.userId;
    const data = await this.service.getRecruiterStats(userId);
    const chartData = await this.service.getRecruiterChartData(userId);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      company: data.company,
      stats: data.stats,
      chartData: JSON.stringify(chartData),
      activePage: 'dashboard', // Highlight Sidebar
    };
  }

  // ==================================================================
  // KHU VỰC QUẢN LÝ VIỆC LÀM (JOBS) - LƯU Ý THỨ TỰ ROUTE
  // ==================================================================

  // 1. Trang Form Đăng Tin (GET /recruiter/jobs/create)
  // [QUAN TRỌNG]: Phải đặt route này TRƯỚC route 'jobs/:id' để tránh lỗi 500
  @Get('jobs/create')
  @Render('recruiter/post-job')
  getPostJobPage(@Req() req: any) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      user: req.user,
      activePage: 'post-job', // Highlight Sidebar mục "Đăng tin mới"
    };
  }

  // 2. Danh sách tin đã đăng (GET /recruiter/jobs)
  // Đã đổi từ 'my-jobs' thành 'jobs' cho chuẩn RESTful
  @Get('jobs')
  @Render('recruiter/my-jobs')
  async getMyJobs(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const jobs = await this.service.getMyJobs(userId);

    const jobsWithSkills = jobs.map((job) => ({
      ...job,
      skillNames: job.jobSkills.map((js) => js.skill.skill_name).join(', '),
    }));

    return {
      jobs: jobsWithSkills,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      activePage: 'jobs', // Highlight Sidebar mục "Tin đã đăng"
    };
  }

  // 3. Xử lý Đăng Tin Mới (POST /recruiter/jobs)
  @Post('jobs')
  async createJob(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RecruiterCreateJobDto,
  ) {
    // Strategy jwt-web trả về req.user.userId
    const userId = req.user.userId;

    // Log để kiểm tra ID trước khi lưu (Giúp bạn debug)
    console.log(`Recruiter ID ${userId} đang tạo job mới...`);

    const job = await this.service.createJob(userId, dto);

    // Gửi thông báo Firebase (Topic cho ứng viên)
    await this.firebaseService.sendNotificationToTopic(
      'job_alerts',
      '🔥 Việc làm mới!',
      `${job.title} tại ${job.location}`,
      { jobId: job.job_id.toString(), type: 'NEW_JOB_POST' },
    );

    return job;
  }

  // 4. Chi tiết tin tuyển dụng (GET /recruiter/jobs/:id)
  // Route này bắt tham số động, nên phải để SAU route tĩnh 'jobs/create'
  @Get('jobs/:id')
  @Render('recruiter/job-detail')
  async getJobDetail(@Req() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userId = req.user.userId;
    const jobId = +id; // Chuyển chuỗi sang số

    const job = await this.service.getJobDetail(userId, jobId);
    if (!job) {
      throw new NotFoundException('Job không tìm thấy');
    }

    const applications = await this.service.getJobApplications(userId, jobId);

    return {
      job: {
        ...job,
        skillList: job.jobSkills.map((js) => js.skill.skill_name),
      },
      applications,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      activePage: 'jobs', // Vẫn highlight mục "Tin đã đăng" khi xem chi tiết
    };
  }

  // ==================================================================
  // CÁC CHỨC NĂNG KHÁC
  // ==================================================================

  @Get('jobs/:jobId/applications')
  async getJobApplications(@Req() req: any, @Param('jobId') jobId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.getJobApplications(req.user.userId, +jobId);
  }

  @Patch('applications/:id/status')
  async updateApplicationStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ValidationPipe()) dto: UpdateApplicationStatusDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.service.updateApplicationStatus(req.user.userId, +id, dto);
  }

  @Get('chat')
  @Render('recruiter/chat')
  getChatPage(@Req() req: any) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      activePage: 'chat',
    };
  }

  @Get('company-profile')
  @Render('recruiter/company-profile')
  async getCompanyProfilePage(@Req() req: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const company = await this.service.getMyCompanyProfile(req.user.userId);
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: req.user,
      company: company,
      activePage: 'profile',
    };
  }

  @Patch('company-profile')
  async updateCompanyProfile(
    @Req() req: any,
    @Body(new ValidationPipe()) dto: UpdateCompanyDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return await this.service.updateCompanyProfile(req.user.userId, dto);
  }

  @Get('comments')
  @Render('recruiter/comments')
  async getCommentsPage(@Req() req: any) {
    const comments = await this.commentService.getCommentsByRecruiter(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      req.user.userId,
    );
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      user: req.user,
      comments: comments,
      activePage: 'comments',
    };
  }

  @Delete('comments/:id')
  async deleteComment(@Req() req: any, @Param('id') id: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    await this.commentService.deleteComment(+id, req.user.userId, 'RECRUITER');
    return { message: 'Deleted successfully' };
  }
}