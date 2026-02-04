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
import { Roles } from '../decorator/role-admin-recruiter.decorator';
import { RecruiterService } from './recruiter.service';
import { RecruiterCreateJobDto } from '../recruiter-dto/recruiter-create-job.dto';
import { UpdateApplicationStatusDto } from '../recruiter-dto/update-application-status.dto';
import { WebAuthGuard } from '../guard/web-auth.guard';
import { UpdateCompanyDto } from '../recruiter-dto/update-company.dto';
import { CommentService } from '../comments/comments.service';
import { RolesGuard } from '../guard/role-auth.guard.admin.recruiter';
import { NotificationEntity } from '../entity/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('recruiter')
@UseGuards(WebAuthGuard,RolesGuard)
@Roles(1, 3)
export class RecruiterController {
  constructor(
    private readonly service: RecruiterService,
    private readonly commentService: CommentService,
    @InjectRepository(NotificationEntity)
    private readonly notiRepo: Repository<NotificationEntity>
  ) {}

  @Get('dashboard')
  @Render('recruiter/dashboard')
  async getDashboard(@Req() req: any) {
    const userId = req.user.userId;
    // 1. Lấy thống kê tổng quan
    const data = await this.service.getRecruiterStats(userId);

    // 2. Lấy dữ liệu biểu đồ (MỚI)
    const chartDataObj = await this.service.getRecruiterChartData(userId);

    return {
      user: req.user,
      company: data.company,
      stats: data.stats,
      chartData: JSON.stringify(chartDataObj), // Chuyển thành chuỗi JSON để HBS dùng
      activePage: 'dashboard',
    };
  }

  @Get('jobs/create')
  @Render('recruiter/post-job')
  getPostJobPage(@Req() req: any) {
    return { user: req.user, activePage: 'post-job' };
  }

  @Post('jobs/generate-ai')
  async generateJobAI(@Body('prompt') prompt: string) {
    if (!prompt) return { success: false, message: 'Nhập mô tả!' };
    try {
      const data = await this.service.generateJobContentWithAI(prompt);
      return { success: true, data };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  @Get('jobs')
  @Render('recruiter/my-jobs')
  async getMyJobs(@Req() req: any) {
    const jobs = await this.service.getMyJobs(req.user.userId);
    return { jobs, user: req.user, activePage: 'jobs' };
  }

  @Post('jobs')
  async createJob(
    @Req() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: RecruiterCreateJobDto,
  ) {
    return await this.service.createJob(req.user.userId, dto);
  }

  @Get('jobs/:id')
  @Render('recruiter/job-detail')
  async getJobDetail(@Req() req: any, @Param('id') id: string) {
    const job = await this.service.getJobDetail(req.user.userId, +id);
    if (!job) throw new NotFoundException('Job not found');
    const apps = await this.service.getJobApplications(req.user.userId, +id);

    const safeApps = apps.map(app => ({
      ...app,
      user: app.user || { full_name: 'Unknown', email: '', avatar_url: '' },
      cv: app.cv
    }));

    return {
      job: { ...job, skillList: job.jobSkills?.map(js => js.skill.skill_name) || [] },
      applications: safeApps,
      user: req.user,
      activePage: 'jobs',
    };
  }

  @Post('analyze-cv/:id')
  async analyzeCv(@Param('id') id: number) {
    const html = await this.service.analyzeCvMatch(id);
    return { html };
  }

  @Patch('applications/:id/status')
  async updateApplicationStatus(
    @Req() req: any, @Param('id') id: string, @Body() dto: UpdateApplicationStatusDto
  ) {
    return this.service.updateApplicationStatus(req.user.userId, +id, dto);
  }

  @Get('company-profile')
  @Render('recruiter/company-profile')
  async getCompanyProfile(@Req() req: any) {
    const company = await this.service.getMyCompanyProfile(req.user.userId);
    return { user: req.user, company, activePage: 'profile' };
  }

  @Patch('company-profile')
  async updateCompany(@Req() req: any, @Body() dto: UpdateCompanyDto) {
    return this.service.updateCompanyProfile(req.user.userId, dto);
  }

  @Get('notifications')
  @Render('recruiter/notifications')
  async getNotis(@Req() req: any) {
    const notifications = await this.notiRepo.find({
      where: { user: { user_id: req.user.userId } },
      order: { created_at: 'DESC' },
      take: 20
    });
    return {
      notifications,
      user: req.user,
      activeNoti: true,
      activePage: 'notifications'
    };
  }

  @Get('comments')
  @Render('recruiter/comments')
  async getCommentsPage(@Req() req: any) {
    const comments = await this.commentService.getCommentsByRecruiter(req.user.userId);
    return {
      user: req.user,
      comments: comments,
      activePage: 'comments'
    };
  }

  @Delete('comments/:id')
  async deleteComment(@Req() req: any, @Param('id') id: number) {
    return await this.commentService.deleteComment(id, req.user.userId, 'RECRUITER');
  }
}